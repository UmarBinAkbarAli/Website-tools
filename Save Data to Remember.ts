<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyAUGilqghgflt6TtIhL8fb7uIHcc4UOiB0",
    authDomain: "teleprompter-141125.firebaseapp.com",
    projectId: "teleprompter-141125",
    storageBucket: "teleprompter-141125.firebasestorage.app",
    messagingSenderId: "654621480722",
    appId: "1:654621480722:web:6c9b0bc6989265902385cb",
    measurementId: "G-0N16J2C7H4"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>