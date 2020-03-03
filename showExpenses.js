
const moment = require('moment-timezone'); 
const {sqlAll} = require('./dbFunctions'); 
const {sendMessage} = require('./telegram'); 

function showExpensesNew(command, db, chatID, userID, messageDate) {
  console.log('showExpNew, command:', command); 
  command = command.toLowerCase(); 
  const thisRegExpString = "t(?:h|)(?:i|)(?:s|)\\b";  
  const periodRegExpString = "(?:(?:d(?:a|)(?:y|))|(?:w(?:e|)(?:e|)(?:k|))|(?:m(?:o|)(?:n|)(?:t|)(?:h|))" + 
    "|(?:y(?:e|)(?:a|)(?:r|)))\\b"; 
  const monthNameRegExpString = "(?:(?:jan(?:u|)(?:a|)(?:r|)(?:y|))|(?:feb(?:r|)(?:u|)(?:a|)(?:r|)(?:y|))" + 
    "|(?:mar(?:c|)(?:h|))|(?:apr(?:i|)(?:l|))|(?:jun(?:e|))|(jul(?:y|))|(?:aug(?:u|)(?:s|)(?:t|))" + 
    "|(?:sep(?:t|)(?:e|)(?:m|)(?:b|)(?:e|)(?:r|))|(?:oct(?:o|)(?:b|)(?:e|)(?:r|))|(?:nov(?:e|)(?:m|)(?:b|)(?:e|)(?:r|))" + 
    "|(dec(?:e|)(?:m|)(?:b|)(?:e|)(?:r|)))\\b";
  const commandRegExpString = "(?<command>e[a-zA-Z]*)(?:\\s+(?<thisArg>" + thisRegExpString + "))?" + 
    "(?:\\s+(?<periodArg>" + periodRegExpString + "))?" + "(?:\\s+(?:(?<monthNameArg>" + monthNameRegExpString + ")" + 
    "|(?<dateArg>(?:\\d\\d[\\.-\\/][01]\\d(?:[\\.-\\/]\\d\\d\\d\\d)?))))?" + "(?:\\s+(?:(?<sumsArg>sum(?:s|))|(?<allArg>all)))?" + 
    "(?:\\s+(?<oneCategoryArg>onec(?:a|)(?:t|)(?:e|)(?:g|)(?:o|)(?:r|)(?:y|)))?" +
    "(?:\\s+(?<categoryNameArg>[\\p{L}]+))?" +
    "\\s*"; 
  const commandRegExp = new RegExp(commandRegExpString, 'u');  

  const match = commandRegExp.exec(command); 
  console.log('match: ', match); 
  const {thisArg, periodArg, monthNameArg, dateArg, sumsArg, allArg, oneCategoryArg, categoryNameArg} = match.groups
  console.log(`this ${thisArg}, period ${periodArg}, month ${monthNameArg}, 
    date ${dateArg}, sums ${sumsArg}, all ${allArg}, one category ${oneCategoryArg}, 
    categoryName ${categoryNameArg}`); 
  let period; 
  let dateFrom; 
  let dateBefore; 
  const params = []; 
  params.push(chatID); 
  let userTimezone = 'Europe/Moscow'; 
  if (periodArg !== undefined) {
    period = periodFromWord(periodArg); 
    if (period === '') {
      period = 'day'; 
      console.log('smth wrong with periodArg; by default period = day', period); 
    }} 
  else {
    period = 'day'; 
    console.log('no period in message, by default period = day', period); 
  }
    console.log('showexp period = ', period); 
  if (thisArg === undefined) {
    if (period === 'month' && monthNameArg !== undefined) {
      let monthNumber = monthNumberFromWord(monthNameArg);//returns a number from 0(Jan) to 11(Nov)
      if (monthNumber >= 0){
        dateFrom = moment().month(monthNumber).tz(userTimezone).startOf('month');
        dateBefore = dateFrom.clone().add(1, 'month'); 
        console.log('if #1 - date with monthname: ',dateFrom.format(), dateBefore.format()); 
      } else {
        console.log('error: month number is less than 0', monthNumber); 
        dateBefore = moment(messageDate.toString(), 'X').tz(userTimezone).add(1,'day').startOf('day'); 
        dateFrom = dateBefore.clone().subtract(1, period); 
        console.log('#2 after error: by default a month back from now', dateFrom.format(), dateBefore.format());         
      }
    } else if (dateArg !== undefined) {
      const dateString = dateFromArg(dateArg, messageDate, userTimezone);
      console.log('if #3 date', dateString); 
      if (dateString.startsWith('error')){
        console.log('if #3, error in date case'); 
        sendMessage(chatID, 'Error: date is invalid'); 
        return
      } else {
        dateFrom = moment(dateString, "DD/MM/YYYY"); 
        dateBefore = dateFrom.clone().add(1, period); 
        console.log('if #3, dates from dateArg',dateFrom.format(), dateBefore.format()); 
      }
    } else {
      dateBefore = moment(messageDate.toString(), 'X').tz(userTimezone).add(1,'day').startOf('day'); 
      dateFrom = dateBefore.clone().subtract(1, period); 
      console.log('if #4 no date:', dateFrom.format(), dateBefore.format()); 
    }
  } else { //thisArg found
    if (period === 'week') {
      dateFrom = moment(messageDate.toString(), 'X').tz(userTimezone).startOf(period).add(1,'day'); 
      dateBefore = dateFrom.clone().add(1, period); 
    } else {
      dateFrom = moment(messageDate.toString(), 'X').tz(userTimezone).startOf(period); 
      dateBefore = dateFrom.clone().add(1, period); 
    }
    console.log("if #5 thisArg", dateFrom.format(), dateBefore.format()); 
  }
  if (dateBefore === undefined || dateFrom === undefined || !(dateBefore.isValid()&&dateFrom.isValid())) {
    sendMessage(chatID, 'Error: date is invalid'); 
    console.log('function should return after invalid date'); 
    return; 
  }
  params.push(dateFrom.toDate()); 
  params.push(dateBefore.toDate()); 
  let sums_all = 'sums'; //default value
  if (allArg !== undefined) {
    sums_all = 'all'; 
  } else if (sumsArg !== undefined) {
    sums_all = 'sums'; 
  } else if (period === 'day' || period === 'week') { //if we don't have an arg, let's set a default value depending on period
    sums_all = 'all'; 
  }//for month and year default value is 'sums'
  let textToSend = 'Your expenses for '; 
  if (thisArg !== undefined) {
    textToSend += 'this '; 
    textToSend += period; 
  } else if (dateArg === undefined) {
    textToSend += 'the last ';
    textToSend += period;  
  } else {
    textToSend = textToSend + 'for a ' + period + ' from ' + dateFrom.format() + ' till ' + 
    dateBefore.format() + ':'; 
  }
  let sqlCategoryPart = ''; 
  if (oneCategoryArg !== undefined && categoryNameArg !== undefined) {
    sqlCategoryPart = 'AND Category = ?'; 
    params.push(categoryNameArg); 
    textToSend = textToSend + ' for category ' + categoryNameArg; 
  }
  textToSend += '\n'; 
  console.log('textToSend: ',textToSend); 
  console.log('showExpenses params:', params); 
  let sql = ''; 
  if (sums_all === 'sums') {
    textToSend = textToSend + 'Sum' + '  ' + 'Category\n'; 
    sql = `
      SELECT Category, SUM(Sum) as Sum 
        FROM Expenses
        WHERE chat_id = (?) AND Date >= (?) AND Date < (?)
      ` + 
      sqlCategoryPart +
      `GROUP BY Category`; 
    console.log('sql :', sql); 
    sqlAll(db, sql, params)
    .then(result => {
      result.forEach(element => console.log(element)); 
      result.forEach(element => {
        textToSend = textToSend + element.Sum + '   ' + 
            ((element.Category === '') ? 'no category' : element.Category) + '\n'; 
      })
      sendMessage(chatID, textToSend)
      })
    .catch(err => { 
      if(err) {
        console.log(err);
        sendMessage(chatID, 'An error ocurred, please try again later'); 
      }
    })
  } else {
    sql = `
      SELECT * 
      FROM Expenses WHERE chat_id = (?)
      AND Date >= (?) AND Date < (?)` + sqlCategoryPart; 
    textToSend += '  Date       Sum     Category    Comment\n'; 
    console.log('showExpenses, going to call sqlAll, sql: ', sql); 
    sqlAll(db, sql, params)
    .then(result => {
      console.log('result in showExpenses (no-sum-select: ', result); 
      result.forEach(element => {
        console.log(element.chat_id, 
        element.exp_id, new Date(element.Date), element.Sum, element.Category, 
        element.Comment);
        let recordDate = moment(element.Date).tz(userTimezone)
        let recordDay = recordDate.get('date').toString(); 
        console.log('record date: ', recordDay); 
        let recordMonth = (recordDate.get('month') + 1).toString(); 
        console.log('record date: ', recordMonth); 
        let recordYear = recordDate.get('year'). toString(); 
        console.log('record year: ', recordYear); 
        textToSend = textToSend +/* element.exp_id + */ + recordDay + '/' + recordMonth + 
          '/' + recordYear + '  ' + element.Sum + '  ' + ((element.Category === '') ? 'no category' : element.Category) + 
          '     ' + element.Comment + '\n'; 
      })
      console.log('textToSend', textToSend)
      sendMessage(chatID, textToSend)
    })
    .catch(err => {
      if (err) {
        console.log('error after calling sqlAll:',err); 
        sendMessage(chatID, 'An error ocurred, please try again later')
      }
    })
  }
}

function periodFromWord(word) {
  if ('week'.startsWith(word)) {
    console.log ('period = week'); 
    return 'week'; 
  } else if ('month'.startsWith(word)) {
    console.log('period = month'); 
    return 'month'; 
  } else if ('day'.startsWith(word)){
    console.log('period = day'); 
    return 'day';
  } else if ('year'.startsWith(word)){
    console.log ('period = year')
    return 'year'; 
  } else {
    return ''; 
  }
}

function monthNumberFromWord(word){
  word = word.toLowerCase()
  if ('january'.startsWith(word)){
    console.log('monthName = January, monthNumber = 0'); 
    return 0; 
  } 
  if ('february'.startsWith(word)){
    console.log('monthName = February, monthNumber = 1'); 
    return 1; 
  }
  if ('march'.startsWith(word)){
    console.log('monthName = March, monthNumber = 2'); 
    return 2; 
  }
  if ('april'.startsWith(word)){
    console.log('monthName = April, monthNumber = 3'); 
    return 3; 
  }
  if ('may'.startsWith(word)){
    console.log('monthName = May, monthNumber = 4'); 
    return 4; 
  }
  if ('june'.startsWith(word)){
    console.log('monthName = June, monthNumber = 5'); 
    return 5;  
  }
  if ('july'.startsWith(word)){
    console.log('monthName = July, monthNumber = 6'); 
    return 6; 
  }
  if ('august'.startsWith(word)){
    console.log('monthName = August, monthNumber = 7'); 
    return 7; 
  }
  if ('september'.startsWith(word)){
    console.log('monthName = September, monthNumber = 8'); 
    return 8; 
  }
  if ('october'.startsWith(word)){
    console.log('monthName = October, monthNumber = 9'); 
    return 9; 
  }
  if ('november'.startsWith(word)){
    console.log('monthName = November, monthNumber = 10'); 
    return 10; 
  }
  if ('december'.startsWith(word)){
    console.log('monthName = December, monthNumber = 11'); 
    return 11; 
  }
  return -1; 
}

function dateFromArg(dateArg, messageDate, userTimezone) {
  const dateRegExp = /(?<date>\d\d)[\.-\/](?<month>[01]\d)(?:[\.-\/](?<year>\d\d\d\d))?/gui; 
  const matchDate = dateRegExp.exec(dateArg); 
  console.log('dataArg: ', dateArg)
  console.log('dateFromArg, match:',matchDate); 
  let date =  matchDate.groups.date;
  let month = matchDate.groups.month; 
  let year = matchDate.groups.year ? matchDate.groups.year : moment(messageDate.toString(), 'X').tz(userTimezone).year().toString(); 
  console.log(`dateFromArg, date: ${date}, month: ${month}, year: ${year}`); 
  if (Number(date) <= 0 || Number(date) > 31) {
    console.log('date is invalid'); 
    return 'error: date is invalid'; 
  }
  if (Number(month) <= 0 || Number(month) > 12) {
    console.log('month is invalid'); 
    return 'error: month is invalid'; 
  }
  return (date + '/' + month + '/' + year); 
}

exports.showExpensesNew = showExpensesNew