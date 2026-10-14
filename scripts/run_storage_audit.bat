@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=C:\Program Files\Android\Android Studio\jbr\bin;%PATH%"
call firebase emulators:exec --only firestore,storage "npx mocha --timeout 45000 test/storage_rules_audit.test.js"
