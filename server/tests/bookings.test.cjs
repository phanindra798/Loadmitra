const {test}=require('node:test');
const assert=require('node:assert/strict');
process.env.NODE_ENV='test';process.env.MONGODB_URI='mongodb://127.0.0.1:1/isolated';process.env.JWT_SECRET='isolated-tests-only-secret-not-for-production';
const {Booking}=require('../dist/models/booking.model');
const {User}=require('../dist/models/user.model');
const {createBooking,getBooking,cancelBooking}=require('../dist/controllers/bookings.controller');
const {acceptRequest,updateTripStatus}=require('../dist/controllers/trips.controller');
const {createApp}=require('../dist/app');
// This suite stubs persistence; real index enforcement is covered by integration tests.
Booking.collection.createIndex = async () => 'one_active_trip_per_captain';
let row;
const payload={bookingId:'LM-TEST-123456',mode:'full',pickup:{label:'A'},drop:{label:'B'},distanceKm:100,truckTypeId:'ace',truckTypeName:'Spoofed',loadWeightKg:500,agreedPrice:1};
const req=(userId='owner',body=payload)=>({auth:{userId,role:'shipper'},body,params:{id:payload.bookingId}});
function res(){return {code:200,setHeader(){},status(n){this.code=n;return this},json(v){this.body=v;return this}}}
function matches(q){return row && Object.entries(q).every(([k,v])=>{
 if(k==='$or')return v.some(matches);
 if(typeof v==='object'&&v!==null){if('$exists' in v)return (row[k]!==undefined)===v.$exists;if('$lte' in v)return row[k]<=v.$lte && row[k]>v.$gt;if('$in' in v)return v.$in.includes(row[k]);throw new Error('unsupported test query')}
 return row[k]===v;
})}
User.findById=async id=>({_id:id,name:'Registered '+id,phone:'9000000001',vehicle:{vehicleNumber:'TS09AB1234',truckTypeId:'ace',city:'Hyderabad'}});
Booking.findOne=async q=>matches(q)?{...row}:null;
Booking.findOneAndUpdate=async(q,u)=>{
 if(u.$setOnInsert){
  if(row && !matches(q)) throw Object.assign(new Error('duplicate'),{code:11000});
  if(!row) row={...q,...u.$setOnInsert};
  return {...row};
 }
 if(!matches(q))return null;
 row={...row,...u.$set};return {...row};
};
async function create(user='owner',body=payload){const r=res();await createBooking(req(user,body),r);return r}
async function accept(user){const r=res();await acceptRequest(req(user,{captain:{id:'forged',name:'Forged',badges:['verified']}}),r);return r}
test('booking ownership and fare derive from authenticated account and catalogue',async()=>{
 row=null;const r=await create();assert.equal(r.code,201);assert.equal(row.shipperId,'owner');assert.equal(row.customerName,'Registered owner');assert.equal(row.truckTypeName,'Tata Ace');assert.equal(row.agreedPrice,2050);
 assert.equal(row.priceSnapshot.estimate,2050);assert.equal(row.priceSnapshot.ratePerKm,18);assert.equal(r.body.data.pickup.label,'A');
});
test('retry cannot reopen or reprice an accepted booking',async()=>{
 row=null;await create();const snapshot=structuredClone(row.priceSnapshot);await accept('captain-a');await create('owner',{...payload,agreedPrice:999999,priceSnapshot:{estimate:1}});assert.equal(row.status,'accepted');assert.equal(row.acceptedByCaptainId,'captain-a');assert.equal(row.agreedPrice,2050);assert.deepEqual(row.priceSnapshot,snapshot);
});
test('same ID with another owner or different load returns conflict',async()=>{
 row=null;await create();assert.equal((await create('intruder')).code,409);assert.equal((await create('owner',{...payload,loadWeightKg:600})).code,409);
});
test('invalid truck and overcapacity loads rejected',async()=>{
 row=null;assert.equal((await create('owner',{...payload,truckTypeId:'missing'})).code,400);assert.equal((await create('owner',{...payload,loadWeightKg:751})).code,400);assert.equal(row,null);
});
test('another shipper cannot read booking status',async()=>{
 row=null;await create();const r=res();await getBooking(req('intruder'),r);assert.equal(r.code,404);
});
test('two claim attempts produce one winner; supplied captain identity ignored',async()=>{
 row=null;await create();const responses=await Promise.all([accept('captain-a'),accept('captain-b')]);assert.deepEqual(responses.map(r=>r.code).sort(),[201,409]);assert.equal(row.captain.id,row.acceptedByCaptainId);assert.notEqual(row.captain.name,'Forged');assert.deepEqual(row.captain.badges,[]);
});
test('nonowner cannot change trip and owner cannot skip lifecycle steps',async()=>{
 row=null;await create();await accept('captain-a');let r=res();await updateTripStatus(req('captain-b',{status:'enroute_pickup'}),r);assert.equal(r.code,404);
 r=res();await updateTripStatus(req('captain-a',{status:'delivered',otp:'123456'}),r);assert.equal(r.code,409);assert.equal(row.tripStatus,'accepted');
 r=res();await updateTripStatus(req('captain-a',{status:'enroute_pickup'}),r);assert.equal(r.code,200);assert.equal(row.tripStatus,'enroute_pickup');
});
test('unknown trip update is not reported as success',async()=>{row=null;const r=res();await updateTripStatus(req('captain',{status:'enroute_pickup'}),r);assert.equal(r.code,404)});
test('booking HTTP routes reject anonymous and captain sessions',async()=>{
 const server=createApp().listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{const url='http://127.0.0.1:'+server.address().port+'/api/bookings';
 let r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});assert.equal(r.status,401);await r.text();
 const {signToken}=require('../dist/middleware/auth');r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+signToken({userId:'captain',role:'captain'})},body:JSON.stringify(payload)});assert.equal(r.status,403);await r.text();
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
});

test('shipper cancellation requires ownership and rejects loaded trips',async()=>{
 row=null;await create();let r=res();await cancelBooking(req('intruder'),r);assert.equal(r.code,409);assert.equal(row.status,'open');
 r=res();await cancelBooking(req(),r);assert.equal(r.code,200);assert.equal(row.status,'cancelled');assert.equal((await accept('captain-a')).code,409);
 row=null;await create();await accept('captain-a');row.tripStatus='picked';r=res();await cancelBooking(req(),r);assert.equal(r.code,409);assert.equal(row.tripStatus,'picked');
});
