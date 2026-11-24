/* Do4You, sync layer.
   Today: local only. Every save goes to localStorage (see app.js, keys
   starting with "ta_"), so the app fully works on GitHub Pages with no
   account, no keys and no network beyond the page itself.

   Later: Firebase Realtime Database. When window.TA_FIREBASE_CONFIG is set
   (see firebase-config.js), TASync.push() should mirror each localStorage
   key to the same path in the database, and TASync.listen() should subscribe
   to those paths and re-render when another phone changes them. The hooks
   below are the exact places to wire that in. Until then they are safe
   no-ops and the app never waits on the network.

   Planned paths in Realtime Database (one node per localStorage key):
     /tournaments, /fixtures, /registrations, /winners, /results,
     /live/badminton, /live/cricket, /live/football
   Planned rules: public read, write only for the Top Admin and scorers
   (Firebase Auth to be added at that point, not now).
*/

(function () {
  'use strict';

  var config = window.TA_FIREBASE_CONFIG || null;

  window.TASync = {
    /* 'local' until a Firebase config is provided. */
    mode: config ? 'firebase-ready' : 'local',
    ready: false,

    /* Called by app.js after every local save. No-op until Firebase is wired. */
    push: function (key, value) {
      if (!config) return;
      /* Firebase wiring goes here, for example:
         firebase.database().ref(key).set(value);
         (load the Firebase SDK scripts in each page first) */
    },

    /* Called once per page when Firebase is wired. No-op until then. */
    listen: function (onRemoteChange) {
      if (!config) return;
      /* Firebase wiring goes here, for example:
         firebase.database().ref().on('value', function (snap) {
           onRemoteChange(snap.val() || {});
         }); */
    }
  };
})();
