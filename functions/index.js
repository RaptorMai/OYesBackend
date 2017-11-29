const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(functions.config().stripe.testkey);
const cors = require('cors')({origin: true});
const gcs = require('@google-cloud/storage')()

admin.initializeApp(functions.config().firebase);


exports.createStripeUser = functions.auth.user().onCreate(event => {

	const data = event.data;
	// Check if a customer is a student
	console.log(data.phoneNumber);
	if (data.phoneNumber != null){
		/*var maxUser = 100;
		var refNumUser = admin.database().ref("/globalConfig/numCurrentUser");
		refNumUser.once("value").then(snapshot => {
			var numUser = snapshot.val();
			numUser += 1
			console.log("Number of current user");
			console.log(numUser);
			refNumUser.set(numUser, function(error){
				if (error) {
					console.log("Set number of current users" + error);
				};
						
			});
			if (numUser >= maxUser){
				admin.database().ref("/globalConfig/canRegister").set(false, function(error){
					if (error) {
						console.log("Can't set " + error);
					}
				})
			}
		})*/
		stripe.customers.create(function(err, customers){

			if(err){ return console.log(err);}

			console.log("creating stripe customer");
			console.log(customers);

			admin.database().ref(`/users/${data.phoneNumber}/payments/customerId`).set(customers.id, function(error){
				if (error) {
					console.log("Stripe customerID cannot be written into db: " + error);
				};

				admin.database().ref(`/users/${data.phoneNumber}/balance`).set(15, function(error){
					if (error) {
						console.log("New user balance cannot be created: " + error);
					};
					return console.log("Student account has been all setup");
				});
			});
		});

		admin.database().ref(`/users/${data.phoneNumber}/email`).set("Please add email", function(error){
					if (error) {
						console.log("New user email cannot be created: " + error);
					};
					return console.log("email setup");
		});
		admin.database().ref(`/users/${data.phoneNumber}/username`).set("Please add username", function(error){
					if (error) {
						console.log("New user username cannot be created: " + error);
					};
					return console.log("name setup");
		});
		admin.database().ref(`/users/${data.phoneNumber}/grade`).set("Please select grade", function(error){
					if (error) {
						console.log("New user grade cannot be created: " + error);
					};
					return console.log("grade setup");
		});
		admin.database().ref(`/users/${data.phoneNumber}/profilepicURL`).set("", function(error){
					if (error) {
						console.log("New user profilepicURL cannot be created: " + error);
					};
					return console.log("profilepicURL setup");
		});

		admin.database().ref(`/users/${data.phoneNumber}/discountAvailable`).set(5, function(error){
					if (error) {
						console.log("New user discountAvailable cannot be created: " + error);
					};
					return console.log("discountAvailable setup");
		});
	}
	// if phoneNumber does not exist, means user is a tutor
	// Here we can set up tutor in the future
	else { 
		var tid = data.email;
		tid = tid.replace("@", ""); 
		tid = tid.replace(/\./g, ""); 
		console.log(tid)
		admin.database().ref(`/tutors/${tid}/profilepicURL`).set("", function(error){
					if (error) {
						console.log("New user profilepicURL cannot be created: " + error);
					};
					return console.log("profilepicURL setup");
		});
		admin.database().ref(`/tutors/${tid}/username`).set("", function(error){
					if (error) {
						console.log("New user username cannot be created: " + error);
					};
					return console.log("username setup");
		});
		admin.database().ref(`/tutors/${tid}/balance`).set(0, function(error){
					if (error) {
						console.log("New user balance cannot be created: " + error);
					};
					return console.log("balance setup");
		});
		admin.database().ref(`/tutors/${tid}/stars`).set(0, function(error){
					if (error) {
						console.log("New user stars cannot be created: " + error);
					};
					return console.log("stars setup");
		});
		admin.database().ref(`/tutors/${tid}/totalQuestionNum`).set(0, function(error){
					if (error) {
						console.log("New user totalQuestionNum cannot be created: " + error);
					};
					return console.log("totalQuestionNum setup");
		});
		admin.database().ref(`/tutors/${tid}/email`).set(data.email, function(error){
					if (error) {
						console.log("New user email cannot be created: " + error);
					};
					return console.log("email setup");
		});
		return console.log("This is a tutor, so no need to create stripe account");
	}
});

// Create a stripe charge to a customer ID
exports.stripeCharge = functions.database
								.ref('/users/{userId}/payments/charges/{id}/content')
								.onWrite(event => {
									console.log("a new charge is written into db");
									event.data.adminRef.parent.child("error").remove()
									// here val is {amount:xxx, discount:<0,1>}
									const val = event.data.val();
									admin.database().ref("/globalConfig/discountRate").once("value").then(snapshot => {
										const discountRate = snapshot.val();
										console.log("discount rate");
										console.log(discountRate);
										return discountRate;
									}).then(disRate => {

									// here this two then callback could be combined
									// val should be amount of purchase
									console.log("purchase info");
									console.log(val);

									var amount;

									if (val.discount == true){
										amount = Math.ceil(disRate * val.amount);  
									}
									else {
										amount = val.amount;
									};
									return amount;

								}).then(amount => {
									// optimization: could change db architecture to use stripe customer ID as a key
									return admin.database().ref(`/users/${event.params.userId}/payments/customerId`)
												.once('value')
												.then(snapshot => {
													console.log("Stripe customer ID");
													console.log(snapshot.val());
  
													// get customerID to prepare a charge
													return snapshot.val();
												})
												.then(customer => {
													// get customerID to prepare a charge
													console.log("customer ID");
													console.log(customer);
													const idempotency_key = event.params.id;
													const currency = 'cad';
													const charge = {amount, currency, customer};

													console.log('creating a charge to the customers...');

													// if (val.source !== null) charge.source = val.source;

													return stripe.charges.create(charge, {idempotency_key}, function(err, charge){
														// If charge is not created successfully, return error
														// TODO: check format of error, see if frontend need to handle
														if (err){

															// if error happens when charging customer
															// write a error message to database
															// print error in firebase console
															console.log(err.type);
															console.log(err.message);
															return event.data.adminRef.parent.child("error").set(err.message);
														}

														// if no error occures, write charge info to db
														return event.data.adminRef.parent.child("paymentDetail").set(charge);
													});
												})
								})
								});

// Add a payment token to create a card source for a specific user
exports.addPaymentToken = functions.database.ref('/users/{userId}/payments/sources/token').onWrite(event => {
	console.log("a new token/source is added to user's account");
	event.data.adminRef.parent.child('error').remove()
	const source = event.data.val();
	console.log("this should be the token");
	console.log(event.data.val());
	console.log("adding new source to customer");
	if (source === null) return null;
	console.log("what is event.params.userId");
	console.log(event.params);
	console.log(event.params.userId);

	// get customerId
	return admin.database().ref(`/users/${event.params.userId}/payments/customerId`).once('value')
		   .then(snapshot => {
	// 	   	console.log("This is the customer ID to add card to");
	// 	   	console.log(snapshot.val());
	// 	   	// return the customer id to add a source
 	//    		return snapshot.val();
	// }).then (customer => {
				console.log("customer inside addPaymentToken");
				console.log(snapshot.val());
				console.log("please let this be the token");
				console.log(source);

				// return a customer object
				// here snapshot.val is stripe customer ID
				return stripe.customers.retrieve(snapshot.val(), function(err, customerobj){
					if (err) {
						event.data.adminRef.parent.child('error').set(err.message);
					}
					else {
						console.log("got customer object");
						if (customerobj.default_source == null) {
						console.log("current customer has no card in account, adding new one");
						console.log(source);
						return stripe.customers.createSource(customerobj.id, {source}, function(err, customer){
							if (err) {
								event.data.adminRef.parent.child('error').set(err.message);
							}
							else {
								console.log("response from addPaymentToken");
								console.log(customer);
								
								//write to another node, otherwise this function will be triggered twice
								return event.data.adminRef.parent.child('cardInfo').set(customer);
							}
						});
						}
						else {
							console.log("updating customer card");
							return stripe.customers.update(customerobj.id, {source}, function(err, customer){
								if (err) {
									event.data.adminRef.parent.child('error').set(err.message);
								}
								else{
									console.log("response from addPaymentToken");
									console.log(customer);
									
									//write to another node, otherwise this function will be triggered twice
									return event.data.adminRef.parent.child('cardInfo').set(customer);
								}
							});
						}
					}
				});
  		});
	// 	.then(customerobj => {
 //  			console.log("got customer object");

	// 		if (customerobj.default_source == null) {
	// 			console.log("current customer has no card in account, adding new one");
	// 			console.log(source);

	// 			return stripe.customers.createSource(customerobj.id, {source});
	// 		}
	// 		else {
	// 			console.log("updating customer card");

	// 			return stripe.customers.update(customerobj.id, {source});
	// 		}
	// }).then(response => {

	// 	console.log("response from addPaymentToken");
	// 	console.log(response);
	// 	return event.data.adminRef.set(response);
	// }, error => {
	// 	console.log(error);
	// 	return event.data.adminRef.parent.child('error').set(userFacingMessage(error));

	//  	});
	});

//--------------------------------------------------------------when charge return an error will also be written into {pid}--------
// Update student balance everytime when they purchase a package
exports.updateBalance = functions.database.ref('/users/{sid}/payments/charges/{pid}/paymentDetail').onWrite(event => {
	const sid = event.params.sid;
	const id = event.params.pid;
	console.log(event.params);
	admin.database().ref(`/users/${sid}/payments/charges/${id}/content/amount`).once("value").then(snapshot => {
		const amount = snapshot.val();
		console.log("what is amount");
		console.log(amount);
		const date = event.data.val().created;

		var addBalanceHistory = admin.database().ref("/users/" + sid + "/completeBalanceHistory/" + id);
		var ref = admin.database().ref("/users/" + sid + "/balance");

		ref.once("value").then(snapshot => {
			console.log("what is snapshot in balance");
			console.log(snapshot.val());
			var currentBalance = snapshot.val();
			// console.log(price);
			let amountString = amount.toString();
			console.log(amountString);

			let mins = admin.database().ref("/priceForBack/" + amountString);
			mins.once("value").then(snapshot => {
				console.log("what is the increment");
				var increment = snapshot.val();
				console.log(increment);
				currentBalance += increment;
				console.log(currentBalance);
				ref.set(currentBalance);
				return increment;
			}).then(timePurchased => {
					addBalanceHistory.set({
								price: amount,
								timePurchased: timePurchased,
								date: date
							});
			})
		})
	});
	// console.log("what is amount");
	// console.log(amount);
	// const date = event.data.val().created;


	// var addBalanceHistory = admin.database().ref("/users/" + sid + "/completeBalanceHistory/" + id);
	// var ref = admin.database().ref("/users/" + sid + "/balance");

	// ref.once("value").then(snapshot => {
	// 	console.log("what is snapshot in balance");
	// 	console.log(snapshot.val());
	// 	var currentBalance = snapshot.val();
	// 	// console.log(price);
	// 	let amountString = amount.toString();
	// 	console.log(amountString);

	// 	let mins = admin.database().ref("/priceForBack/" + amountString);
	// 	mins.once("value").then(snapshot => {
	// 		console.log("what is the increment");
	// 		var increment = snapshot.val();
	// 		console.log(increment);
	// 		currentBalance += increment;
	// 		console.log(currentBalance);
	// 		ref.set(currentBalance);
	// 		return increment;
	// 	}).then(timePurchased => {
	// 			addBalanceHistory.set({
	// 						price: amount,
	// 						timePurchased: timePurchased,
	// 						date: date
	// 					});
	// 	})
	// })
});


exports.inactiveQuestion = functions.database.ref('/Request/active/{category}/{questionId}/rate').onUpdate(event => {
	
	console.log("getin");
	const questionId = event.params.questionId;
	const category = event.params.category;
	console.log(questionId);
	var ref = admin.database().ref("/Request/active/" + category +"/"+ questionId);
	console.log("inactiveQuestion triggered");
	ref.once("value").then(snapshot => {
		var changedQ = snapshot.val();
		console.log("what does it return");
		console.log(snapshot.val());
		console.log("removing node");
		ref.remove().then(function(){
			console.log("add to inactive");
			var reference = admin.database().ref("/Request/inactive/" + category +"/"+ questionId);
	   		reference.set(changedQ);
		});
	})
})


// Update student/tutor balance when they finish a session
exports.consumeBalance = functions.database.ref('/Request/inactive/{category}/{questionId}').onCreate(event => {

	const qid = event.params.questionId;
	const category = event.params.category;
	console.log(qid);
	console.log(category);

	var ref = admin.database().ref("/Request/inactive/" + category + "/" + qid);
	//const sid = ref.once("value").then(snapshot => {
	ref.once("value").then(snapshot => {
		console.log(snapshot.val());
		const sid = "+1" + snapshot.val().sid;
		console.log(sid);
		const tid = snapshot.val().tid;
		console.log(tid);
		const sessionTime = snapshot.val().duration;
		const rate = snapshot.val().rate;

		// Update student balance
		console.log("update student balance");
		console.log(sid);
		admin.database().ref("/users/" + sid + "/balance").once("value").then(snapshot => {
			console.log(snapshot.val());
			admin.database().ref("/users/" + sid + "/balance").set(snapshot.val() - sessionTime)
		})

		var today = new Date().getTime();

		var addBalanceHistory = admin.database().ref("/users/" + sid + "/completeBalanceHistory/" + qid);
		addBalanceHistory.set({
								sessionTime: sessionTime,
								date: today,
								category: category
							});

		// Update complete tutor balance + detailed breakdowns
		console.log("update tutor balance");
		var completeTutorProfile = admin.database().ref("/tutors/" + tid);

		// Update tutor overall balance
		completeTutorProfile.child("balance").once("value").then(snapshot => {
			completeTutorProfile.child("balance").set(parseInt(snapshot.val()) + parseInt(sessionTime))
		});

		// Update tutor overall star
		completeTutorProfile.child("stars").once("value").then(snapshot => {
			completeTutorProfile.child("stars").set(parseFloat(snapshot.val()) + parseFloat(rate))
		});

		// Update tutor overall qnum
		completeTutorProfile.child("totalQuestionNum").once("value").then(snapshot => {
			completeTutorProfile.child("totalQuestionNum").set(parseInt(snapshot.val()) + 1)
		});

		// Add detailed balance history transaction
		var tutorBalanceHistory = admin.database().ref("/tutors/" + tid + "/completeBalanceHistory/" + qid);
		tutorBalanceHistory.set({
								sessionTime: sessionTime,
								date: today,
								category: category
							});

		// Update tutor monthly data
		var year = new Date().getFullYear();
		var month = new Date().getMonth() + 1;

		var tutorBalanceHistory = admin.database().ref("/tutors/" + tid + "/monthlyBalanceHistory/" + year + month);
		console.log("/tutors/" + tid + "/monthlyBalanceHistory/" + year + month)
		// Update monthly total
		tutorBalanceHistory.child("monthlyTotal").once("value").then(snapshot => {
			console.log("monthlyTotal")
			if (snapshot.val() == null){
				console.log("monthlyTotal null")
				console.log(0 + parseInt(sessionTime))
				tutorBalanceHistory.child("monthlyTotal").set(0 + parseInt(sessionTime));
			}
			else{
				console.log("monthlyTotal out")
				console.log(parseInt(snapshot.val()) + parseInt(sessionTime))
				tutorBalanceHistory.child("monthlyTotal").set(parseInt(snapshot.val()) + parseInt(sessionTime));
			}
			
		});

		// Update monthly stars
		tutorBalanceHistory.child("stars").once("value").then(snapshot => {
			if (snapshot.val() == null){
				tutorBalanceHistory.child("stars").set(0 + parseFloat(rate));
			}
			else{
				tutorBalanceHistory.child("stars").set(parseFloat(snapshot.val()) + parseFloat(rate));
			}
		});

		// Update monthly total question numbers
		tutorBalanceHistory.child("qnum").once("value").then(snapshot => {
			if (snapshot.val() == null){
				tutorBalanceHistory.child("qnum").set(1);
			}
			else{
				tutorBalanceHistory.child("qnum").set(parseInt(snapshot.val()) + 1);
			}
			
		});
	})
})

// Pull category from database
exports.getCategory = functions.https.onRequest((req, res) => {
	var result = [];
	cors(req, res, () => {
		admin.database().ref("/category").once("value").then(function(snapshot) {
			snapshot.forEach(function(childSnapshot) {
				result.push({"category": childSnapshot.key,
							"subCate": childSnapshot.val()});
			});
		}).then(function(){
				res.status(200).send(JSON.stringify(result));
			});
	});
});

exports.cancel = functions.https.onRequest((req, res) => {


  // [START usingMiddleware]
  // Enable CORS using the `cors` express middleware.
  cors(req, res, () => {
  // [END usingMiddleware]
    // Reading date format from URL query parameter.
    // [START readQueryParam]
    /*
    let format = req.query.format;
    // [END readQueryParam]
    // Reading date format from request body query parameter
    if (!format) {
      // [START readBodyParam]
      format = req.body.format;
      // [END readBodyParam]
    }
    // [START sendResponse]
    const formattedDate = moment().format(format);
    console.log('Sending Formatted date:', formattedDate);
    res.status(200).send(formattedDate);*/
    // [END sendResponse]

    let qid = req.query.qid;
    let category = req.query.category;
    var ref = admin.database().ref("/Request/active/" + category +"/"+ qid);
	ref.on("value", function(snapshot) {
		if (snapshot.exists()) { 
			let url = snapshot.val().picURL
			const filePath = 'image/' + category + '/' + qid
			const bucket = gcs.bucket("instasolve-d8c55.appspot.com")
			const file = bucket.file(filePath)
			const pr = file.delete()
		    ref.remove();
		    ref.off();
		  }
	})

    res.status(200).send(req.query.category);
  });
});

exports.promotion = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
  	let code = "Vobii";
    var uid = req.query.uid;
    var promotion = req.query.promotion;
    let increment = 15;
    var refPro = admin.database().ref(`promotion/${code}/${uid}`);
    if (promotion == code){

    	refPro.once("value").then(function(snapshot) {
    		if (snapshot.exists()) {
    			return res.status(200).send({"result": false, "balance":0});
    		}
    		else{
    			admin.database().ref(`/promotion/${code}/${uid}`).set(true, function(error){
    				if (error) {
    					console.log(`promotion ${uid} cannot be set: ` + error);
    				};
    				console.log(`/promotion/${code}/${uid} set`);
    				
    			});
    			var refBal = admin.database().ref("/users/" + uid + "/balance");
    			refBal.once("value").then(snapshot => {
    				console.log("what is snapshot in balance");
    				console.log(snapshot.val());
    				var currentBalance = snapshot.val();
    				currentBalance += increment;
    				console.log(currentBalance);
    				refBal.set(currentBalance);	
    				return res.status(200).send({"result": true, "balance":currentBalance});	
    			})
    		}
    	})
    }else{
    	return res.status(200).send({"result": false, "balance":0});
    }
	
  });
});

exports.sendTutorNotification = functions.database.ref('/Request/active/{category}/{qid}').onCreate(event => {

	const category = event.params.category;
	return loadUsers(category).then(notification => {
		const payload = {
		  notification: {
		    title: `New ${category} question posted`,
		    body: `Please help my ${category} question`,
		    sound: 'default',
		    badge: '1'
		  }
		};
		console.log("back" + notification)
        return admin.messaging().sendToDevice(notification, payload);
    });
})

exports.sendStudentNotification = functions.database.ref('/Request/active/{category}/{qid}/status').onUpdate(event => {
	const category = event.params.category;
	event.data.ref.parent.child('sid').on("value", function(snapshot) {
		var sid = snapshot.val()
		console.log(sid)
		if (event.data.val() == 1){

			return loadStudentToken(sid).then(notification => {
				const payload = {
				  notification: {
				    title: `Tutor connected`,
				    body: `Your ${category} tutor is connected`,
				    sound: 'default'
				  }
				};
				console.log("back" + notification)
		        return admin.messaging().sendToDevice(notification, payload);
	    	});

		}
		else if(event.data.val() == 2){
			return loadStudentToken(sid).then(notification => {
				const payload = {
				  notification: {
				    title: `Session begins`,
				    body: `Your ${category} session begins`,
				    sound: 'default'
				  }
				};
				console.log("back" + notification)
		        return admin.messaging().sendToDevice(notification, payload);
	    	});
		}
	})
})

function loadUsers(category) {
	let tutorRef = admin.database().ref('/tutors');
	var notification = [];
	console.log(category);
    let defer = new Promise((resolve, reject) => {
        tutorRef.orderByChild("category/" + category).equalTo(true).on("value", function(snapshot)  {
            snapshot.forEach(function(data) {
                
                let token = data.val().token;
                console.log(token);
                if (token) {
                    notification.push(token);
              
                }
                
            });
            console.log("before" + notification)
            resolve(notification);
        }, (err) => {
            reject(err);
        });
    });
    return defer;
}

function loadStudentToken(sid){
	let uid = "+1" + sid;
	console.log("uid" + uid)
	let studentRef = admin.database().ref(`/users/${uid}/token`);
	let defer = new Promise((resolve, reject) => {
		studentRef.on("value", function(snapshot) {
			console.log(snapshot.val())
			resolve(snapshot.val());
		},(err) => {
            reject(err);
        });
	})
	return defer;
}

function userFacingMessage(error) {
  return error.type ? error.message : 'An error occurred, developers have been alerted';
}



