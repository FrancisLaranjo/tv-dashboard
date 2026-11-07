// Background service: opens the Home dashboard when the TV boots or wakes from standby.
// Samsung "Instant On" suspends the TV instead of shutting it down, so a cold-boot hook
// alone would rarely fire. A suspended TV freezes this timer; on resume the wall clock
// has jumped far past the timer period, and that jump is the wake signal.
var APP_ID = 'TvHomeDash.Home';
var TICK_MS = 5000;
var WAKE_GAP_MS = 60000;

function launchHome() {
  try {
    tizen.application.launch(APP_ID, function () {}, function (e) { console.log('launch failed: ' + e.message); });
  } catch (e) {
    console.log('launch threw: ' + e.message);
  }
}

module.exports.onStart = function () {
  var last = Date.now();
  setTimeout(launchHome, 8000);
  setInterval(function () {
    var now = Date.now();
    if (now - last > WAKE_GAP_MS) setTimeout(launchHome, 4000);
    last = now;
  }, TICK_MS);
};

module.exports.onRequest = function () {};
module.exports.onExit = function () {};
