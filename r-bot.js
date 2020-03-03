const dotenv = require('dotenv');
dotenv.config(); 
const axios = require('axios'); 
const EventEmitter = require('events'); 
const geoTZ = require('geo-tz'); 
const {
  openDB, createTableExpenses, 
  insertRowIntoExpenses, deleteRowFromExpensesByMessageID, 
  createTableCategories,  findCategoriesByWords, 
  createTableChatSettings, 
  createTableNames, createTableProgramSettings, 
  getMessageOffset, sqlRun
} = require('./dbFunctions') 
const {
    processBotCommand, 
    setTimezone
} = require('./processCommand'); 

const { sendCommand, sendMessage } = require('./telegram'); 

const {getSum, isDate, makeComment, getWordsForSearch} = require('./processTextFunctions'); 
const myEventEmitter = new EventEmitter(); 
openDB('./sv_bot.db')
.then(result => {
  const db = result; 
  Promise.all([createTableExpenses(db), 
    createTableCategories(db),  
    createTableChatSettings(db),  
    createTableNames(db), 
    createTableProgramSettings(db),
  ]).then(() => {
    console.log('all promises resolved'); 
    let mesOffset = 0; 
    myEventEmitter.on('startBot', () => { onStartBot(db) });  
    myEventEmitter.emit('startBot');
  })
})
.catch(err => {
  console.log('error while opening database:', err.message); 
})
let mesOffset = 0; 



function onStartBot(db)
{
  console.log('onStartBot started!\n'); 
  getMessageOffset(db)
  .then(result => {
    console.log('got messOffset:',result.messOffset); 
    return sendCommand('getUpdates', 
      {offset: mesOffset, timeout: 100} 
    )})
    .then(response =>  {
      const data = response.data; 
      console.log('response data:',data);
      if (data.result.length === 0) {
        console.log('data result is empty')
        myEventEmitter.emit('startBot')
        return
      }
      const updates = data.result
      const updateNumber = parseInt(updates[updates.length - 1].update_id)
      mesOffset = updateNumber + 1
      console.log('new mesOffset =', mesOffset, '\n')
      let updateChatID = 0
      console.log('updates: ', updates, ' updates.length', updates.length, ' updates[0]: ', updates[0], ' updates[1]: ', updates[1])
      if (updates[updates.length - 1].message || updates[updates.length - 1].edited_message) {
        isUpdateMessage = 1
        updateChatID = updates[updates.length - 1].message ? updates[updates.length - 1].message.chat.id : 
          updates[updates.length - 1].edited_message.chat.id   
      }
      let sqlMessageOffset = `INSERT INTO program_settings (lastUpdate, chatID, isMessage, lastUpdateFinished)
        VALUES (?, ?, ?, ?)`; 
      params = [updateNumber, updateChatID,isUpdateMessage, 1]
      console.log('params for programSettings: ', params)
      sqlRun(db, sqlMessageOffset, params)
      .catch(err => {
        console.log('error inserting into program_settings', err)
      }) 
      let n = 0
      const updatesToSkip = new Set()
      for (n = updates.length - 1; n > 0; n--) {
        if (updates[n].edited_message) {
          const editedMessageID = updates[n].edited_message.message_id
          const editedMessageChatID = updates[n].edited_message.chat.id
          console.log("edited message id and chat id: ", editedMessageID, ', ', editedMessageChatID)
          let k = 0; 
          for (k = n - 1; k >= 0; --k) {
            let thisMessageID = 0
            let thisMessageChatID = 0 
            if (updates[k].message) {
              thisMessageID = updates[k].message.message_id
              thisMessageChatID = updates[k].message.chat.id
            } else if (updates[k].edited_message) {
              thisMessageID = updates[k].edited_message.message_id
              thisMessageChatID = updates[k].edited_message.chat.id
            }
            if (thisMessageChatID === editedMessageChatID && thisMessageID === editedMessageID) {
              updatesToSkip.add(k)
            }
          }
        }
      }
      console.log('updatesToSkip: ', updatesToSkip)
      let x = 0
      for (x = 0; x <=  updates.length; x++) {
        console.log('got in for cycle, x = ', x)
        if (x === updates.length) {
          console.log('x === updates.length')
          myEventEmitter.emit('startBot')
          return
        }
        if (updatesToSkip.has(x)) {
          continue
        }
        console.log('x !== updates.length, x = ', x, 'updates.length = ', updates.length)
        console.log('update id:', updates[x].update_id, '\n')
        if (updates[x].message) {
          console.log('new message text:', updates[x].message.text)
          console.log('update id:', updates[x].update_id, 'message: ', updates[x].message.text,'\n')
          processNewMessage(updates[x].message, db)
        } else if (updates[x].edited_message) {
          const message = updates[x].edited_message
          console.log('edited mesage:', message.text)
          console.log('edited message id:', message.message_id)
          processEditedMessage(message, db)
        } else {
          //update isn't a message
          console.log('update isn\'t a message')
        }
       }
    })
    .catch(function(err){
      console.log('Catch: ', err); 
    }) 
}
    
function processNewMessage(message, db){
  if (message.text) {
    if(message.text[0] == '/') {
      console.log("it's a command"); 
      processBotCommand(message.text,message.chat.id, message.from.id, message.date, db)
    } else if (message.text.startsWith('Set my timezone to')) {
      let chosenTimezone; 
      console.log('found set timezone text'); 
      if (message.text == 'Set my timezone to UTC') {
        console.log('UTC timezone'); 
        chosenTimezone = 'Etc/UTC';
      } else {
        chosenTimezone = message.text.slice('Set my timezone to '.length); 
      }
      console.log('chosen timezone', chosenTimezone); 
      setTimezone(db, message.chat.id, chosenTimezone)
    } else if (message.text === 'Cancel') {
      sendCommand('sendMessage', {
        chat_id: message.chat.id, 
        text: 'ok', 
        timeout: 100, 
        reply_markup: {remove_keyboard: true}
      })
      .catch(err => {
        console.log(err)
      })
    } else {
      processExpenseRecord(message, db) 
    }
  } else if (message.location) {
    console.log('location from message:', message.location); 
    let TZFromLocationResults = geoTZ(message.location.latitude, message.location.longitude); 
    console.log('timezone recognized from location', TZFromLocationResults); 
    if (TZFromLocationResults.length < 1) {
      console.log('set timezone error: no timezone found for this location/ '); 
      sendMessage(chatID, 'error: no timezone for this location')
    } else {
      let tzButtonsArray = [];
      TZFromLocationResults.forEach(tzName => {
        let newTZButton = {text: 'Set my timezone to ' + tzName}; 
        tzButtonsArray.push(newTZButton); 
      }); 
      console.log('array of tz buttons:',tzButtonsArray); 
      let tzKeyboard = {keyboard: [tzButtonsArray]}
      let selectTzText = 'Please select your timezone'; 
      if (tzButtonsArray.length == 1) {
        selectTzText = 'We think your timezone is ' + TZFromLocationResults[0]; 
      }
      tzButtonsArray.push({text: 'Cancel'}); 
      sendCommand('sendMessage', {
        chat_id: message.chat.id, 
        text: selectTzText, 
        timeout: 100, 
        reply_markup: tzKeyboard
      })
      .catch(function(err){
        console.log('error sending message while choosing location', err)
      }) 
    }
  }
}

function processEditedMessage (message, db){
  chatID = message.chat.id
  messageID = message.message_id
  deleteRowFromExpensesByMessageID(db,chatID, messageID)
  .then(() => {
    if (message.text) {
      if (message.text.startsWith('/')) {
        processBotCommand(message.text, message.chat.id, message.from.id, message.date, db)
      } else {
        processExpenseRecord(message, db) 
      }
    }
  })
  .catch((err) => {
    console.log(err)
    sendMessage(chatID, 'this edited message wasn\'t processed correctly')
  })
}

function processExpenseRecord(message, db) {
  let str = message.text.split('\n');
  console.log('processExpenseRecord, new message text: ', message.text);
  console.log('message id: ', message.message_id); 
  console.log('str result:',str); 
  const mesDate = message.forward_date ? new Date(message.forward_date * 1000) : new Date(message.date * 1000); 
  console.log('mesDate:', mesDate); 
  const sender = message.forward_from ? message.forward_from : message.from; 
  console.log('sender:', sender); 
  const senderID = sender.id; 
  console.log('sender\'s id: ', senderID); 

  for (let x in str) {
    const messageRow = str[x]; 
    console.log('parsing string \"',messageRow , '\"'); 
    const words = messageRow.split(' '); 
    const chatID = message.chat.id; 
    const messageID = message.message_id; 
    console.log('ProcessExpenseRecord, chatID', chatID); 
    let sumRes = getSum(words); 
    let sum = sumRes.sumNum; 
    let sum_index = sumRes.sumIndex; 

    if (isNaN(sum)) {
      console.log('processExpenseRecord sum is NaN:', sum); 
      return
    }
    let comment = makeComment(words, sum_index); 
    let wordsForSearch = getWordsForSearch(words, sum_index); 
    let sqlIns = `INSERT INTO Expenses (Date, Sum, Comment, Category, FullMessage) 
      VALUES (?, ?, ?, ?, ?)`;
    let params = [];
    params.push(chatID); 
    params.push(messageID); 
    params.push(senderID); 
    params.push(mesDate); 
    params.push(sum); 
    params.push(comment); 
    findCategoriesByWords(db, message.chat.id, wordsForSearch)
    .then(function(result) {
      console.log('processExpenseRecord, result of findCategoriesByWords:', result); 
      let category; 
      if (result === null || result.length === 0) {
        category = ''; 
        let warning = 'no category found for this expense record\n' + messageRow; 
        sendMessage(chatID, warning); 
      } else {
        category = result[0]; 
        if (result.length > 1) {
          let warning = 'found more than 1 category for this expense record, "' + category + '" is set as category. \n' + messageRow; 
          sendMessage(chatID, warning); 
        }
      }
      params.push(category); 
      params.push(str[x]); 
      console.log('params: ', params); 
      insertRowIntoExpenses(db, params)
      .then(result => {
        console.log('result of insertRowIntoExpenses in processExpenseRecord: ', result)
      })
      .catch(err => {
        console.log('insertRowIntoExpenses error: ', err)
      })
    })
    .catch(err => {
      console.log('processExpenseRecord error: ', err); 
      let warning = 'Error occured and expense record wasn\'t added\n' + str[x]; 
      sendMessage(chatID, warning); 
    })
  }
}






