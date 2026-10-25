const {test}=require('node:test');
const assert=require('node:assert/strict');
const {TRUCK_TYPES}=require('../dist/data/trucks');
const {estimatePrice}=require('../dist/services/pricing.service');
const {estimateFare}=require('../dist/services/earnings.service');
for(const truck of TRUCK_TYPES) for(const mode of ['full','shared','return']) {
 test(`${truck.id} ${mode}: captain fare equals shipper quote`,()=>{
  for(const distanceKm of [1,100,575,100.25]) {
   const input={truck,mode,distanceKm,loadWeightKg:truck.capacityKg*0.37};
   assert.equal(estimateFare(input),estimatePrice(input).estimate);
  }
 });
}
test('100 km Tata Ace fare regression',()=>assert.equal(estimateFare({truck:TRUCK_TYPES[0],mode:'full',distanceKm:100}),2050));
