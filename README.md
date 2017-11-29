### How to deploy Firebase cloud functions:
1. make sure you are in firebase file directory and you have firebase CLI tools installed

[To install firbase CLI tool](https://firebase.google.com/docs/cli/)

2. firebase does not support node 8.0.0, if you are using 8.0.0 make sure you switch verison using NVM

[To install and setup NVM](http://dev.topheman.com/install-nvm-with-homebrew-to-use-multiple-versions-of-node-and-iojs-easily/)

3. Once you have everything setup
```
>>> firebase init functions
>>> cd functions
>>> npm install strip --save
>>> firebase functions:config:set stripe.testkey=""
```
firebase init functions will generate firebase.json and functions folder
after npm install, copy index.js, firebase deploy
4. delpoy firebase functions:
```
>>> firebase deploy --only functions: <function name you want to deploy>
```
