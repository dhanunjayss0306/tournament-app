/* Do4You, Firebase config.
   This file is intentionally EMPTY. The app works fully without Firebase:
   all scores, tournaments, fixtures, registrations and winners are saved
   in the browser (localStorage) on this device.

   To turn on live sync across phones later:
   1. Create a Firebase project at console.firebase.google.com.
   2. Add a Web App, then create a Realtime Database.
   3. Copy the web app config object here and set window.TA_FIREBASE_CONFIG
      to it, for example:
         window.TA_FIREBASE_CONFIG = {
           apiKey: "PASTE_YOUR_API_KEY_HERE",
           authDomain: "your-project.firebaseapp.com",
           databaseURL: "https://your-project-default-rtdb.firebaseio.com",
           projectId: "your-project",
           storageBucket: "your-project.appspot.com",
           messagingSenderId: "000000000000",
           appId: "1:000000000000:web:0000000000000000000000"
         };
   4. Follow the wiring notes in sync.js.
   Do not commit real keys to a public repo. Keep this file empty until then.
*/

window.TA_FIREBASE_CONFIG = null;
