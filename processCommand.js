const moment = require('moment-timezone'); 
const { getWords } = require('./processTextFunctions'); 
const { addKeywordToCategories, selectSortedCategoryKeywordFromCategories } = require('./dbFunctions.js'); 
const { sendCommand, sendMessage } = require('./telegram'); 
const botName = process.env.RECEIPTS_BOT_NAME; 
const addKeywordCommand = 'addkeyword'; 
const startCommand = 'start'; 
const showExpensesCommand = 'expenses'; 
const showKeywordsCommand = 'showkeywords'; 
const setNameCommand = 'name'
const helpCommand = 'help'; 
const {
  selectWhereFromBeforeExpenses, 
  selectSumByCategoriesFromExpenses, getTimezoneFromChatID, 
  selectTimezoneForChatID, 
  upsertRowIntoChatSettings, sqlRun
} = require('./dbFunctions')
const {showExpensesNew} = require('./showExpenses')

function processBotCommand(command, chatID, senderID, mesDate, db) {
  console.log('chatID:', chatID); 
  console.log('botName: ', botName); 
  command = command.slice(1); 
  if (command.search(/[@][A-z]+/) >= 0 && command.search(botName) < 0) {
    console.log('not my bot name, command not for my bot'); 
    return; 
  }
  console.log('command for my bot'); 
  const botNameIndex = command.indexOf('@'); 
  if (botNameIndex >= 0) {
    command = command.slice(0, botNameIndex); 
  }
  const commandWords = getWords(command).map(word => word.toLowerCase()); 
  console.log('commandWords[0](going to recognizeCommandName):', commandWords[0]); 
  let commandName = recognizeCommandName(commandWords[0]);
  switch(commandName) {
    case addKeywordCommand: 
      console.log('addKeywordCommand'); 
      addKeyword(commandWords, db, chatID)
      break; 
    case startCommand: 
      console.log('startCommand'); 
      startCommandFunction(chatID)
      break; 
    case helpCommand: 
      console.log('helpCommamd'); 
      //helpCommandFunction(); 
      break; 
    case setNameCommand: 
      console.log('setName command'); 
      setNameForSender(db, chatID, senderID, command)
      break; 
    case showExpensesCommand: 
      console.log('showExpensesCommand'); 
      showExpensesNew(command, db, chatID, senderID, mesDate)
      break; 
    case showKeywordsCommand: 
      console.log('showKeywordsCommand'); 
      showKeywordsFunction(db, chatID)
      break; 
    default: 
      console.log('command not found'); 
      sendMessage(chatID, 'not a valid command')
      return 0; 
      break; 
  }
}

function recognizeCommandName(shortName) {
  console.log('function recognizeCommandName, shortName:', shortName);
  shortName = shortName.toLowerCase(); 
  console.log('function recognizeCommandName, shortName after low:', shortName);
  if (addKeywordCommand.startsWith(shortName)) {
    console.log('recognizeCommandName:command addkeyword recognized'); 
    return addKeywordCommand; 
  } else if (startCommand.startsWith(shortName)) {
    console.log('recogniaeCommand: command start recognized'); 
    return startCommand; 
  } else if (helpCommand.startsWith(shortName)) {
    console.log('recogniaeCommand: command help recognized'); 
    return helpCommand; 
  } else if (showExpensesCommand.startsWith(shortName)) {
    console.log('recogniaeCommand: command showexpenses recognized'); 
    return showExpensesCommand; 
  } else if (showKeywordsCommand.startsWith(shortName)) {
    console.log('recognoseCommandName: command showkeywords recognized'); 
    return showKeywordsCommand; 
  } else if (setNameCommand.startsWith(shortName)) {
    console.log('recognizeCommandName: setNameCommand recognized')
    return setNameCommand; 
  } else { 
    return 0; 
  }
}

function addKeyword(commandWords, db, chatID) {
  let indexCommandWords = 1; 
  if (commandWords.length < 3) {
    console.log('addkeyword error: no category or no keyword'); 
    sendMessage(chatID, 'no category or no keyword in addkeyword command')
    return 
  }
  const category = commandWords[indexCommandWords++]; 
  for ( ; indexCommandWords < commandWords.length; indexCommandWords++) {
    let keyword = commandWords[indexCommandWords]; 
    addKeywordToCategories(db, chatID, keyword, category)
    .then (result => {
      let text = 'added keyword "' + keyword + '" for category "' + category + '"'; 
      sendMessage(chatID, text); 
    })
    .catch(err => {
      console.log('addKeyword function, error:', err);
      sendMessage(chatID, 'An error ocurred, keyword wasn\'t added')
    })
  }
}

function startCommandFunction(chatID) {
  sendCommand('sendMessage', {
    chat_id: chatID,
    text: 'Please share your location. We need it to set your timezone.',
    timeout: 100, 
    reply_markup: {
      keyboard: [
        [
          {
            text: 'Share my location',
            request_location: true
          },
          {
            text: 'Set my timezone to UTC'
          }
        ], 
        [
          {
            text: 'Cancel'
          }
        ]
      ]
    }
  })
  .then(response =>  {var data = response.data; 
      console.log('showExpensesFunctions after sending message', data); 
      return 'start message send'
  })
  .catch(function(err){
    console.log('startFunction error in axios: ', err); 
    return 'error start command message'
  })
}

function periodFromWord(word) {
  let period = word.toLowerCase();
  if ('day'.startsWith(period)) {
    period = 'day'; 
  } else if ('month'.startsWith(period))   {
    period = 'month'; 
  } else if ('week'.startsWith(period)) {
    period = 'week';
  } else if ('year'.startsWith(period)) {
    period = 'year'; 
  } else {
    period = 'day'; 
    console.log('periodFromWord, by default period = day'); 
  }
  console.log('periodFromWord, period: ', period); 
  return period; 
}

function showExpensesFunction(commandWords, db, chatID, mesDate) {
  let userTimezone = '';
  getTimezoneFromChatID(db, chatID)
  .then(result => {
   if (result) {
     userTimezone = result; 
     console.log('userTimezone:', userTimezone); 
    } else {
      userTimezone = 'Etc/UTC'; 
      console.log('no error and no timezone, timezone is utc by def', userTimezone); 
    }
    console.log('userTimezone: ', userTimezone); 
    let indexCommandWords = 1; 
    let period = ''; 
    if (commandWords.length <= indexCommandWords) {
      period = 'day'; 
      console.log('showExpensesFunction, no period, by default period = ', period); 
    } else {
      period = periodFromWord(commandWords[indexCommandWords++]); 
      console.log('showExpensesFunction, period:', period); 
    }
    let dateBefore; 
    let dateFrom; 
    if (commandWords.length <= indexCommandWords){
      dateBefore = moment(mesDate.toString(), 'X').tz(userTimezone).add(1, 'day').startOf('day'); 
      dateFrom = dateBefore.clone().subtract(1, period); 
    } else if (period == 'day') {
      if (isDate(commandWords[indexCommandWords])) {
        let dateArgument = dateFromText(commandWords[indexCommandWords]); 
        dateFrom = moment(dateArgument, "YY-MM-DD").tz(userTimezone).startOf('day'); 
        dateBefore = dateFrom.clone().add(1, period); 
      }
    }
    console.log('showExpensesFunction, date from: ', dateFrom.format(), 'date before: ', dateBefore.format()); 
    let textToSend = 'your expenses for the last ' + period + '\n'; 
    if (period != 'year') {
      selectWhereFromBeforeExpenses(db, chatID, dateFrom.toDate(), dateBefore.toDate())  
      .then(result => {
        console.log('result in ShowExpensesFunction after selectWhereFromExpenses call: \nid   date          sum      category           comment\n');
        result.forEach(element => {console.log(element.chat_id, element.exp_id, new Date(element.Date), element.Sum, element.Category, element.Comment);
          let d = new Date(element.Date); 
          let year = d.getFullYear(); 
          console.log(year);  
          textToSend = textToSend + element.exp_id + ' ' + d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + 
          element.Sum + ' ' + element.Category+ ' ' + element.Comment + '\n'; 
        });
        sendMessage(chatID, textToSend); 
      })
      .catch(err => {
        console.log('showExpensesFunction error: ', err); 
      })
    } else {
      selectSumByCategoriesFromExpenses(db, chatID, dateFrom.toDate(), dateBefore.toDate())
      .then(result => {
        console.log('Result in ShowExpensesFunction after selectSumByCategoriesFromExpenses function call: \n'); 
        result.forEach(element => {
          console.log(element.Category, element.Sum);
          let categoryForMessage = element.Category; 
          if (categoryForMessage === '') {
                categoryForMessage = 'no category'; 
          }
          textToSend = textToSend + categoryForMessage + ': ' + element.Sum +'\n'; 
        })
        sendMessage(chatID, textToSend)
      })
      .catch(err => {
        console.log ('showexpenses Function, error: ', err); 
      })
    }
  })
  .catch(err => {
    console.log('catch: error getting timezone:', err); 
  })
} 

function showKeywordsFunction(db, chatID) {
  selectSortedCategoryKeywordFromCategories(db, chatID)
  .then (result => {
    console.log('showKeywords: ', result); 
    let category; 
    let keywordsCategories = ''; 
    result.forEach((row, index) => {
      if (row.Category === category) {
        keywordsCategories = keywordsCategories + ', ' + row.Keyword; 
      } else if (index > 0) {
        keywordsCategories = keywordsCategories + '\n' + row.Category + ': ' + row.Keyword; 
        category = row.Category;
      } else {
        keywordsCategories = keywordsCategories + row.Category + ': ' + row.Keyword; 
        category = row.Category; 
      }
    })
    console.log('showKeywordsFunction, keywordsCategories: ', keywordsCategories); 
    const textToSend = 'Your categories and keywords: ' + '\n' + keywordsCategories; 
    return sendMessage( chatID, textToSend); 
  })
  .catch(err => {
    console.log('showKeywordsFunction, err:', err); 
  })
}

function setNameForSender(db, chatID, userID, command) {
  console.log('setName, command: ', command); 
  const commandRegExp = /(?<command>[a-zA-Z]+)\s(?<name>[\p{Letter}0-9_\s]+)$/u;
  const match = commandRegExp.exec(command); 
  console.log('set name match: ', match); 
  if (!match || !match.groups.name){ //no name
    const warning = 'No name provided to set'; 
    sendMessage(chatID, warning); 
  }
  const matchedName = match.groups.name; 
  console.log('setName, matched name:', matchedName); 
  let sql = `INSERT INTO Names (chat_id, user_id, userName) 
    VALUES (?, ?, ?)
    ON CONFLICT (chat_id, user_id) DO UPDATE SET userName = ?`;
  let params = [chatID, userID, matchedName, matchedName]; 
  sqlRun(db, sql, params) .then(result => {
    console.log(result); 
    console.log('rows changed: ', result.changes); 
    sendMessage(chatID, 'Name is set')
  })
  .catch(err => {
    if(err) {
      console.log('setNameForSender Error', err);
      sendMessage(chatID, 'an error ocurred, name not updated')
    }
  })
}

function setTimezone(db, chatID, timezone) {
  const isTimezone = findTimezoneInMomentList(timezone); 
  if (isTimezone < 0) {
    console.log('setTimezone error: timezone ', timezone, ' not found in moment timezone list'); 
    const text = 'Error setting timezone: no timezone with name ' + timezone; 
    sendMessage(chatID, text) 
    return;    
  }
  upsertRowIntoChatSettings(db, chatID, timezone) 
  .then(result => {
    console.log('result of upsert:', result)
    sendTimezoneSetMessage(chatID, timezone)}) 
  .then(() => {return selectTimezoneForChatID(db, chatID)})
  .then(rows => {
    console.log('chat settings for chatID ', chatID, ': ',rows)
  })
  .catch(err => {
    console.log('error in setTimezone', err); 
    sendMessage(chatID, 'An error ocurred, timezone wasn\'t updated')
  })
}
 
function findTimezoneInMomentList(timezone) {
  const list = moment.tz.names(); 
  let low = 0; 
  let high = list.length - 1; 
  let mid; 
  while (low <= high) {
    mid = Math.floor((low + high) / 2); 
    console.log('mid = ', mid); 
    if (timezone < list[mid]) {
      console.log(timezone, ' < ', list[mid]); 
      high = mid - 1; 
    } else if (timezone > list[mid]) {
      console.log(timezone, ' > ', list[mid]); 
      low = mid + 1; 
    } else {
      console.log('found timezone ', list[mid]); 
      return mid; 
    }
  }
  return -1; 
}

function sendTimezoneSetMessage(chatID, timezone) {
 return sendCommand('sendMessage', {
    chat_id: chatID, 
    text: ('Thanks, your timezone is set to ' + timezone), 
    timeout: 100,
    reply_markup: {remove_keyboard: true}
    })
  .catch(function(err){
    console.log('error sending message:', err); 
  })
}


exports.processBotCommand = processBotCommand 
exports.setTimezone = setTimezone