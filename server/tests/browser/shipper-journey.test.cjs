// Shipper portal: book -> match -> track -> deliver through the browser, the
// API and an isolated MongoDB (see harness.cjs).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  state, Booking, User, browserErrors, mark, until, evaluate, body, see, loadPage,
  navigate, click, clickUntil, sessionToken, tokenFor, post, screenshot, recordFailure, startStack, stopStack,
} = require('./harness.cjs');
const { RevokedToken } = require('../../dist/models/revoked-token.model');
let base, shipper, captain, shipperToken;

before(async () => {
  ({ base } = await startStack('shipper'));
  [shipper, captain] = await User.create([
    { role: 'shipper', name: 'Journey Shipper', phone: '9000000021' },
    { role: 'captain', name: 'Journey Captain', phone: '9000000022', vehicle: { vehicleNumber: 'TS09CD5678', truckTypeId: 'ace', city: 'Hyderabad' } },
  ]);
  shipperToken = tokenFor(shipper);
}, { timeout: 110000 });

after(stopStack);

const latestBooking = () => Booking.findOne({ shipperId: String(shipper._id) }).sort({ _id: -1 });
const advance = (id, status, otp) => post(`/api/captain/trips/${id}/status`, captain, otp ? { status, otp } : { status });
/** Generates a handover code in the shipper UI and returns the code it displays. */
async function generateCode() {
  await click('Generate new code');
  let code;
  await until(async () => {
    code = await evaluate(`[...document.querySelectorAll('section[aria-label="Handover verification"] p')].map(p => p.textContent.trim()).find(text => /^\\d{6}$/.test(text)) ?? null`);
    return Boolean(code);
  }, 'handover code on screen');
  return code;
}

test('shipper books, is matched, tracks handovers and sees delivery after reload', { timeout: 180000 }, async () => {
  try {
    await navigate('/app/search'); await sessionToken(shipperToken);
    await see('Gachibowli');
    await click('Gachibowli'); await click('Warangal');
    await click('See price estimate'); await see('Book now');
    // 145 km Tata Ace: estimate ₹2,860 shown as a ±8% negotiable range.
    await see('145 km'); await see('₹2,630'); await see('₹3,090');
    mark('Quote shows the estimate range for the chosen route');

    await click('Book now'); await see('Finding the best captain near you');
    const booked = await latestBooking();
    assert.equal(booked.status, 'open'); assert.equal(booked.distanceKm, 145);
    assert.equal(booked.agreedPrice, 2860); assert.equal(booked.truckTypeId, 'ace');
    assert.equal(booked.pickup.label, 'Gachibowli'); assert.equal(booked.drop.label, 'Warangal');
    assert.ok((await body()).includes('₹2,860'));
    mark('Booking is saved with the server-computed distance and the same fare the shipper saw');

    await post(`/api/captain/requests/${booked.bookingId}/accept`, captain);
    await see('A captain accepted your request!'); await see('Journey Captain');
    await screenshot('matched');
    mark('Captain acceptance reaches the matching screen');

    await click('Confirm & track'); await see('Captain arriving in');
    await advance(booked.bookingId, 'enroute_pickup');
    await advance(booked.bookingId, 'at_pickup'); await see('Captain arrived at pickup');
    const pickupCode = await generateCode();
    await advance(booked.bookingId, 'picked', pickupCode); await see('Load picked up');
    mark('Pickup code generated on screen verifies the captain pickup');

    await advance(booked.bookingId, 'enroute_drop'); await see('Arriving in');
    const deliveryCode = await generateCode();
    assert.notEqual(deliveryCode, pickupCode);
    await advance(booked.bookingId, 'delivered', deliveryCode); await see('Delivered 🎉');
    const delivered = await Booking.findById(booked._id);
    assert.equal(delivered.tripStatus, 'delivered'); assert.ok(delivered.completedAt);
    assert.equal(delivered.handoverOtp, undefined);
    await screenshot('delivered');
    mark('Delivery code verifies the drop and the shipper sees Delivered');

    await loadPage('Page.reload', {}); await see('Delivered 🎉');
    await navigate('/app/bookings'); await see('Warangal');
    mark('Delivered trip survives reload and appears in booking history');

    await navigate('/app/search'); await see('Gachibowli');
    await click('Gachibowli'); await click('Warangal');
    await click('See price estimate'); await see('Book now');
    await click('Book now'); await see('Finding the best captain near you');
    const second = await latestBooking(); assert.notEqual(second.bookingId, booked.bookingId);
    await click('Cancel request');
    await until(async () => (await Booking.findById(second._id)).status === 'cancelled', 'cancelled in MongoDB');
    mark('Shipper can cancel a request while searching');

    await navigate('/app/account'); await see('Log out');
    await clickUntil('Log out', async () => (await RevokedToken.countDocuments()) === 1, 'session revoked in MongoDB');
    const reuse = await fetch(base + '/api/bookings', { headers: { Authorization: 'Bearer ' + shipperToken }, signal: AbortSignal.timeout(15000) });
    assert.equal(reuse.status, 401);
    assert.equal(await evaluate(`import('/src/lib/api.ts').then(api => api.getToken())`), null);
    mark('Logging out in the browser revokes the session on the server');

    assert.deepEqual(browserErrors, []);
    mark('No uncaught browser exceptions');
    assert.ok(state.page);
  } catch (error) {
    await recordFailure();
    throw error;
  }
});
