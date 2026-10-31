// Captain portal: Browser -> Express -> isolated MongoDB (see harness.cjs).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  Booking, User, browserErrors, events, mark, until, cdp, evaluate, newPage, body, see, loadPage,
  navigate, click, sessionToken, tokenFor, post, screenshot, recordFailure, startStack, stopStack,
} = require('./harness.cjs');
let page, base, origin, captainA, captainB, owner, tokenA, tokenB;

before(async () => {
  ({ page, base, origin } = await startStack('captain'));
  [captainA, captainB, owner] = await User.create([
    { role: 'captain', name: 'Browser Captain Alpha', phone: '9000000011', vehicle: { vehicleNumber: 'TS09AB1234', truckTypeId: 'ace', city: 'Hyderabad' } },
    { role: 'captain', name: 'Browser Captain Beta', phone: '9000000012', vehicle: { vehicleNumber: 'TS09AB1234', truckTypeId: 'ace', city: 'Hyderabad' } },
    { role: 'shipper', name: 'Browser Shipper', phone: '9000000013' },
  ]);
  tokenA = tokenFor(captainA); tokenB = tokenFor(captainB);
  const load = (id, pickup, extra = {}) => ({ bookingId: id, shipperId: String(owner._id), mode: 'full', pickup: { label: pickup, city: pickup, address: pickup + ' address, Test City' }, drop: { label: 'Browser destination', city: 'Destination', address: '456 Destination Road, Test City' }, distanceKm: 100, truckTypeId: 'ace', truckTypeName: 'Tata Ace', loadWeightKg: 500, agreedPrice: 2050, ...extra });
  await Booking.create(load('LM-BROWSER-ALPHA', 'Alpha pickup'));
  await Booking.create(load('LM-BROWSER-BETA', 'Beta pickup'));
  await post('/api/captain/requests/LM-BROWSER-ALPHA/accept', captainA);
  await post('/api/captain/requests/LM-BROWSER-BETA/accept', captainB);
  await Booking.create(load('LM-BROWSER-OLD', 'Historical pickup', { status: 'accepted', tripStatus: 'delivered', acceptedByCaptainId: String(captainA._id), createdAt: new Date('2020-01-01') }));
  await Booking.insertMany(Array.from({ length: 101 }, (_, i) => load('LM-BROWSER-HISTORY-' + i, 'History ' + i, { status: 'accepted', tripStatus: 'delivered', acceptedByCaptainId: String(captainA._id), createdAt: new Date('2025-01-01') })));
}, { timeout: 110000 });

after(stopStack);

test('captain recovery and account isolation through the browser, API and database', { timeout: 150000 }, async () => {
  try {
    await navigate('/app/trips'); await see('Sign in');
    await sessionToken(tokenA); await see('Alpha pickup');
    await navigate('/app/trip/LM-BROWSER-ALPHA'); await see('Load accepted');
    await loadPage('Page.reload', {}); await see('Head to pickup');
    assert.ok((await body()).includes('Alpha pickup address, Test City'));
    assert.ok((await body()).includes('456 Destination Road, Test City'));
    mark('Active trip survives direct navigation and reload');

    await click('Head to pickup'); await see("I've arrived at pickup");
    assert.equal((await Booking.findOne({ bookingId: 'LM-BROWSER-ALPHA' })).tripStatus, 'enroute_pickup');
    mark('Browser action persists its lifecycle transition in MongoDB');

    await post('/api/bookings/LM-BROWSER-ALPHA/cancel', owner);
    await see('Trip cancelled'); assert.equal((await body()).includes("I've arrived at pickup"), false);
    await screenshot('cancelled-trip');
    mark('Shipper cancellation reaches the captain screen and removes actions');

    await sessionToken(tokenB); await see('Trip not found');
    assert.equal((await body()).includes('Alpha pickup'), false);
    await navigate('/app/trips'); await see('Beta pickup');
    assert.equal((await body()).includes('Alpha pickup'), false);
    await loadPage('Page.reload', {}); await see('Beta pickup');
    mark('Account switch clears Alpha data and restores only Beta data after reload');

    await post('/api/captain/trips/LM-BROWSER-BETA/status', captainB, { status: 'enroute_pickup' });
    await post('/api/captain/trips/LM-BROWSER-BETA/status', captainB, { status: 'at_pickup' });
    const pickupCode = (await post('/api/bookings/LM-BROWSER-BETA/handover-otp', owner)).data.code;
    await post('/api/captain/trips/LM-BROWSER-BETA/status', captainB, { status: 'picked', otp: pickupCode });
    await post('/api/captain/trips/LM-BROWSER-BETA/status', captainB, { status: 'enroute_drop' });
    const deliveryCode = (await post('/api/bookings/LM-BROWSER-BETA/handover-otp', owner)).data.code;
    await navigate('/app/trip/LM-BROWSER-BETA'); await see('Verify drop OTP');
    assert.ok(await evaluate(`(() => { const input = document.querySelector('input[data-input-otp]'); input?.focus(); return Boolean(input); })()`));
    await cdp('Input.insertText', { text: deliveryCode }, page);
    await until(async () => evaluate(`Array.from(document.querySelectorAll('button')).some(button => button.textContent.includes('Verify drop OTP') && !button.disabled)`), 'enabled delivery verification');
    await click('Verify drop OTP'); await see('Delivery confirmed');
    const delivered = await Booking.findOne({ bookingId: 'LM-BROWSER-BETA' });
    assert.equal(delivered.payoutSnapshot.net, 1742); assert.ok(delivered.completedAt);
    await navigate('/app/earnings');
    await until(async () => (await evaluate(`document.querySelector('[data-testid="earnings-total"]')?.textContent`)) === '₹1,742', 'saved delivery earnings');
    await loadPage('Page.reload', {});
    await until(async () => (await evaluate(`document.querySelector('[data-testid="earnings-total"]')?.textContent`)) === '₹1,742', 'earnings survive refresh without doubling');
    assert.ok((await body()).includes('Beta pickup')); await screenshot('saved-earnings');
    mark('Browser-verified delivery saves a payout once, and earnings survive reload');


    await navigate('/app/account'); await see('Saved vehicle: TS09AB1234');
    for (const [id, value] of [['vehicle-number', 'ts-09 xy 7654'], ['vehicle-city', 'Warangal']]) {
      assert.ok(await evaluate(`(() => { const input = document.getElementById(${JSON.stringify(id)}); input?.focus(); input?.select(); return Boolean(input); })()`));
      await cdp('Input.insertText', { text: value }, page);
    }
    await click('Save vehicle'); await see('Saved vehicle: TS09XY7654');
    await loadPage('Page.reload', {}); await see('Saved vehicle: TS09XY7654');
    assert.equal(await evaluate(`document.getElementById('vehicle-city')?.value`), 'Warangal');
    const registered = await User.findById(captainB._id);
    assert.equal(registered.vehicle.vehicleNumber, 'TS09XY7654'); assert.equal(registered.vehicle.city, 'Warangal');
    assert.equal((await Booking.findOne({ bookingId: 'LM-BROWSER-BETA' })).captain.vehicleNumber, 'TS09AB1234');
    assert.ok((await body()).includes('Not submitted')); assert.equal((await body()).includes('Verified'), false);
    await screenshot('saved-vehicle');
    await sessionToken(tokenA); await see('Saved vehicle: TS09AB1234');
    assert.equal((await body()).includes('TS09XY7654'), false);
    await sessionToken(tokenB); await see('Saved vehicle: TS09XY7654');
    mark('Vehicle registration survives reload, preserves historical assignments, stays unverified and is isolated by account');
    await navigate('/app/earnings');
    await until(async () => (await evaluate(`document.querySelector('[data-testid="earnings-total"]')?.textContent`)) === '₹1,742', 'return to Beta earnings');

    const second = await newPage(); await navigate('/app/trips', second);
    await until(async () => (await evaluate('document.body?.innerText ?? ""', second)).includes('Beta pickup'), 'second tab');
    await sessionToken(tokenA, second); await see('102 older completed trip(s)');
    assert.equal(await evaluate(`document.querySelector('[data-testid="earnings-total"]')?.textContent`), '₹0');
    assert.equal((await body()).includes('Beta pickup'), false);
    await navigate('/app/trips'); await see('Alpha pickup');
    assert.equal((await body()).includes('Beta pickup'), false);
    mark('Another tab changing accounts resets the original tab through storage notification');

    await navigate('/app/trip/LM-BROWSER-OLD'); await see('Historical pickup'); await see('Delivery confirmed');
    assert.ok((await body()).includes('LM-BROWSER-OLD'));
    mark('A direct link restores a delivered trip outside the recent 100 records');

    await sessionToken(null); await see('Sign in to view this trip');
    assert.equal((await body()).includes('Historical pickup'), false);
    mark('Logout clears private trip details immediately');

    await sessionToken(tokenA); await navigate('/app/trips'); await see('Alpha pickup');
    const failReads = message => {
      if (message.method !== 'Fetch.requestPaused' || message.sessionId !== page) return;
      void cdp('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 503,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' }],
        body: Buffer.from(JSON.stringify({ error: 'Temporary browser-test outage' })).toString('base64') }, page).catch(() => {});
    };
    events.push(failReads);
    await cdp('Fetch.enable', { patterns: [{ urlPattern: base + '/api/captain/trips*', requestStage: 'Request' }] }, page);
    await loadPage('Page.reload', {}); await see('Could not refresh trips.');
    assert.equal((await body()).includes('No trips here yet'), false);
    await cdp('Fetch.disable', {}, page); events.splice(events.indexOf(failReads), 1);
    await click('Retry'); await see('Alpha pickup');
    mark('An API failure shows an error instead of empty history, and Retry recovers');
    await screenshot('recovered-history');
    await navigate('/app/earnings'); await see('102 older completed trip(s)');
    assert.equal(await evaluate(`document.querySelector('[data-testid="earnings-total"]')?.textContent`), '₹0');
    assert.equal((await body()).includes('Beta pickup'), false);
    assert.equal((await body()).includes('+12%'), false);
    assert.equal((await body()).includes('₹500 bonus'), false);
    mark('Legacy completions are labelled and another captain earnings never leak');
    events.push(failReads);
    await cdp('Fetch.enable', { patterns: [{ urlPattern: base + '/api/captain/earnings', requestStage: 'Request' }] }, page);
    await loadPage('Page.reload', {}); await see('Could not load earnings.');
    assert.equal(await evaluate(`Boolean(document.querySelector('[data-testid="earnings-total"]'))`), false);
    await cdp('Fetch.disable', {}, page); events.splice(events.indexOf(failReads), 1);
    await click('Retry earnings'); await see('102 older completed trip(s)');
    assert.equal(await evaluate(`document.querySelector('[data-testid="earnings-total"]')?.textContent`), '₹0');
    mark('An earnings outage displays an error and retry recovers the saved summary');
    assert.deepEqual(browserErrors, []);
    mark('No uncaught browser exceptions');
  } catch (error) {
    await recordFailure();
    throw error;
  }
});
