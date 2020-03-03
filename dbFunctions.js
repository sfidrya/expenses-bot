const sqlite3 = require('sqlite3').verbose(); 

function openDB(dbName){
  return new Promise((resolve, reject) => {
    let db = new sqlite3.Database(dbName, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err){
        console.error(err.message); 
        reject(err); 
      } else {
        console.log('Connected to the sv_bot database\n'); 
        resolve(db); 
      }
    }); 
  })
}

function dropTable(db, tableName){
  let sqlDropTable = 'DROP TABLE if exists ' + tableName; 
  db.run(sqlDropTable, function(err) {
    if (err) {
      return console.error(err.message); 
    }
    console.log('table', tableName, ' has been dropped\n');
  }); 
}

function alterTableAddSender(db, tableName)
{
  let sql = 'ALTER TABLE ' + tableName + ' ADD COLUMN sender_id INTEGER'; 
  db.run(sql, function(err) {
    if (err) {
      return console.error(err.message); 
    } else { 
      console.log('table ', tableName, ' altered, column chat_id added\n');
    }
  }); 
}

function updateTable(db, tableName, columnName, columnValue)
{
  let sql = 'UPDATE ' + tableName + ' SET ' + columnName + ' = (?)'; 
  db.run(sql, columnValue, function(err){
    if(err) {
      return console.error(err.message); 
    } else {
      console.log(`Rows updated: ${this.changes}`); 
    }
  })
}

function createTableExpenses(db)
{
  let sql = `CREATE TABLE  if not exists Expenses 
    (exp_id INTEGER PRIMARY KEY AUTOINCREMENT, 
      chat_id INTEGER,  message_id INTEGER, 
      sender_id INTEGER, Date INTEGER, Sum INTEGER, 
      Comment TEXT, Category TEXT, FullMessage TEXT)`; 
  return sqlRun(db, sql); 
}

function insertRowIntoExpenses(db, params){
  let sqlIns = 'INSERT INTO Expenses (chat_id, message_id, sender_id, Date, Sum, Comment, Category, FullMessage) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  console.log('InsertRowIntoExpenses, params: ', params); 
  return new Promise(function (resolve, reject) { 
    db.run(sqlIns, params, function(err) {
      if (err) {
        reject(err); 
      } else {
        console.log(`InsertRowIntoExpenses: A row has been inserted with row ID ${this.lastID}`); 
        resolve(this); 
      } 
    }); 
  }) 
}

function deleteRowFromExpensesByMessageID(db, chatID, messageID) {
  const sql = 'DELETE FROM Expenses WHERE chat_id = ? AND message_id = ?'
  return new Promise (function(resolve, reject) {
    if (!chatID) {
      console.log('deleteRowFromExpensesBy, no chat_id'); 
      reject('deleteRowFromExpensesBy, no chat_id'); 
      return; 
    }
    if(!messageID) {
      console.log('deleteRowFromExpensesBy, no message_id'); 
      reject('deleteRowFromExpensesBy, no message_id'); 
      return; 
    }
    db.run(sql, chatID, messageID, function(err){
      if (err) {
        console.log('deleteRowFromExpensesByMessageID, error:', err); 
        reject(err); 
      } else {
        console.log('rows deleted from Expenses', this.changes); 
        resolve(); 
      }
    })
  })
}

function createTableCategories(db)
{
  return new Promise(function(resolve, reject) {
    let sql = `CREATE TABLE  if not exists Categories (keyword_id INTEGER PRIMARY KEY AUTOINCREMENT, 
      chat_id INTEGER, Keyword TEXT, Category TEXT)`; 
    db.run(sql, function(err) {
      if (err) {
        reject(err); 
      } else {
        console.log('table categories created\n');  
        resolve();
      }
    }); 
  })
}

function insertRowIntoCategories(db, params){
  let placeholders = placeholdersForInsertRow(params, 3); 
  console.log('InsertIntoCategories params:', params, 'placeholders:', placeholders, '\n' ); 
  let sqlIns = 'INSERT INTO Categories (chat_id, Keyword, Category) VALUES' + placeholders;
  console.log('InsertRowIntoCategories, params: ', params); 
  return new Promise (function(resolve, reject) {
    db.run(sqlIns, params, function(err) {
      if (err){
        console.log(err.message); 
        reject(err); 
      }
      else {
        console.log(`InsertRowIntoCategories: A row has been inserted with row ID ${this.lastID}`); 
        resolve(this.lastID); 
      }
    }); 
  })
}

function placeholdersForInsertRow(params, nValInRow)
{
  let placeholders = ''; 
  var counter = 0;
  for (x in params) {
    if (counter == 0) {
      placeholders += '('; 
    }
    placeholders += '?'; 
    counter++; 
    if (counter == nValInRow) {
      placeholders += ')';
        counter = 0; 
    } else {
        placeholders += ','; 
    }
  }
  console.log('placeholdersForInsertRow: ', placeholders); 
  return placeholders; 
} 

function selectAllFromCategories(db)
{
  let sql = 'SELECT * FROM Categories'; 
  db.all(sql, [], (err, rows) => {
    if (err) {
      throw err; 
    }
    rows.forEach((row) => {
      console.log(row, '\n'); 
    }); 
  });  
}

function selectFromTable(db, tableName)
{
  let sql = 'SELECT * FROM ' + tableName; 
  db.all(sql, [], (err, rows) => {
    if (err) {
      throw err; 
    }
    console.log('selected from table ', tableName); 
    rows.forEach((row) => {
      console.log(row, '\n'); 
    }); 
  });  
}

function selectSortedCategoryKeywordFromCategories(db, chatID) /*returns a Promise*/
{
  let sql = `SELECT Category, Keyword FROM Categories WHERE chat_id = ? ORDER BY Category, Keyword`; 
  return new Promise(function(resolve, reject) {
    db.all(sql, chatID, (err, rows) => {
      if (err) {
        console.log('error running sql', sql, '\n'); 
        reject(err); 
      } else {
        console.log('select keywords from categories, chat_id = ', chatID, '\n', rows); 
        resolve(rows); 
      }
    });  
  })
}

function selectKeywordsFromCategories(db, chatID) /*returns a Promise*/
{
  const sql = 'SELECT Keyword FROM Categories WHERE chat_id = ?'; 
  const keywords = []; 
  return new Promise(function(resolve, reject) {
    db.all(sql, chatID, (err, rows) => {
      if (err) {
        console.log('error running sql', sql, '\n'); 
        reject(err); 
      } else {
        console.log('select keywords from categories, chat_id = ', chatID, '\n', rows); 
        rows.forEach((row) => {
          keywords.push(row.Keyword);  
        });
        keywords.sort(); 
        console.log('keywords array:', keywords, '\n'); 
        resolve(keywords); 
      }
    });  
  })
}

function findCategoriesByWords(db, chatID, words) /*returns a Promise*/
{
  return new Promise(function(resolve, reject) {
    const nWords = words.length; 
    if (words.length === 0) {
      resolve(null);
      console.log('findCategoriesByWords: no words'); 
      return;  
    }
    let placeholders = '('; 
    for (i = 0; i < nWords - 1; i++) {
      placeholders += '?, '; 
    }
    placeholders += '?)'; 
    let params = []; 
    params.push(chatID); 
    words.forEach(word => {
      params.push(word.toLowerCase()); 
    })
    let sql = 'SELECT DISTINCT Category FROM Categories WHERE chat_id = ? AND Keyword IN ' + placeholders; 
    console.log('sql:', sql, 'params:', params); 
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.log('error running sql', sql, '\n'); 
        reject(err); 
      } else if (rows.length === 0) {
        console.log('no rows found'); 
        resolve(null); 
      } else {
        console.log('select keywords from categories, chat_id = ', chatID, '\n', rows); 
        let categories = []; 
        rows.forEach(row => {categories.push(row.Category)}); 
        resolve(categories); 
      }
    });  
  })
}

function deleteRowFromCategories(db, keyword_id)
{
  return new Promise (function(resolve, reject) {
    let sql = 'DELETE FROM Categories WHERE keyword_id = ?'; 
    console.log('deleteRowFromCategories, keyword_id: ', keyword_id); 
    db.run(sql, keyword_id, function(err) {
      if (err) {
        console.log('deleteRowFromCategories error while running sql:', err); 
        reject(err); 
      } else {
        console.log('deleteRowsFromCategories, rows deleted: ', this.changes, 'ID: ', this.lastID); 
        resolve(this.changes); 
      }
    })
  })
}

function addKeywordToCategories(db, chatID, keyword, category)
{
  keyword = keyword.toLowerCase(); 
  category = category.toLowerCase(); 
  let sql = 'SELECT * FROM Categories WHERE chat_id = (?) AND Keyword = (?)'; 
  return new Promise(function(resolve, reject) {
    db.all(sql, chatID, keyword, (err, rows) => {
      if (err) {
        console.log('addKeywordToCategories error: ', err); 
        reject(err); 
      } else {
        console.log('addKeywordToCategories, rows with keyword ', keyword, 'for chat_id = ', chatID, ': \n', rows ); 
        resolve(rows); 
      }
    })
  })
  .then(function(result) {
    if (result == []) {
      insertRowIntoCategories(db, [chatID, keyword, category]) ; 
    } else {
      let foundSameRowFlag = 0; 
      for (x in result) {
        if (result[x].Category === category) {
          console.log('record keyword = ', keyword, 'category = ', category, ' for chat_id = ', chatID, 'already exists'); 
          foundSameRowFlag = 1; 
        } else {
          console.log('there is record with keyword = ', result[x].Keyword, 'category = ', result[x].Category, 'chat_id = ', result[x].chat_id, 'record id: ', result[x].keyword_id , 'this record will be removed'); 
          deleteRowFromCategories(db, result[x].keyword_id)
            .then(function(result) {
              console.log('the record was succesfully deleted', result); 
            })
            .catch(function(err) {
              if(err) {
                console.log('addKeywordToCategories, error: ', err) 
              }
            })
        }
      } 
      if (!foundSameRowFlag) {
        insertRowIntoCategories(db, [chatID, keyword, category])  
      }
    }
  })
}

function selectWhereFromExpenses(db, chatID, dateFrom) /*returns a Promise*/
{
  let sql = 'SELECT * FROM Expenses WHERE chat_id = (?) AND Date > (?)'; 
  return new Promise(function(resolve, reject) {
    db.all(sql, chatID, dateFrom, (err, rows) => {
      if (err) {
        console.log('error running sql', sql, '\n'); 
        reject(err); 
      } else {
        console.log('select where chat_id = ', chatID, 'date >', dateFrom); 
        rows.forEach((row) => {
          //console.log(row, '\n');
        });
        resolve(rows); 
      }
    })  
  })
}

function selectWhereFromBeforeExpenses(db, chatID, dateFrom, dateBefore) /*returns a Promise*/
{
  let sql = 'SELECT * FROM Expenses WHERE chat_id = (?) AND Date > (?) AND Date < (?)'; 
  return new Promise(function(resolve, reject) {
    db.all(sql, chatID, dateFrom, dateBefore, (err, rows) => {
      if (err) {
        console.log('error running sql', sql, '\n'); 
        reject(err); 
      } else {
        console.log('select where chat_id = ', chatID, 'date >', dateFrom, 'and < ', dateBefore); 
        rows.forEach((row) => {
          console.log(row, '\n');
        });
        resolve(rows); 
    }});  
  })
}

function selectDistinctFromCategories(db, chatID) /*returns a promise*/
{
  let sql = 'SELECT DISTINCT Category From Categories WHERE chat_id = (?)';
  return new Promise(function(resolve, reject){
    db.all(sql, chatID, (err, rows) => {
      if (err) {
        console.log('error running sql', sql); 
        reject(err); 
      } else {
        rows.forEach((row) => { console.log('selectDistinctFromCategories where chat_id = ', chatID, row);}); 
        resolve(rows); 
      }
    })
  }) 
}

function selectSumByCategoriesFromExpenses(db, chatID, dateFrom, dateBefore)
{
  let sql = 'SELECT Category, SUM(Sum) as Sum FROM Expenses WHERE chat_id = (?) AND Date >= (?) AND Date < (?) GROUP BY Category'; 
  return new Promise(function(resolve, reject){
    db.all(sql,chatID, dateFrom, dateBefore, (err, rows) => {
      if (err) {
        console.log('error running sql', sql); 
        reject(err); 
      } else {
        rows.forEach((row) => { console.log('selectSumByCatFromExp, chat_id = ',chatID, row);}); 
        resolve(rows); 
      }
    })
  }) 
}

function createTableChatSettings(db)
{
  let sql = `CREATE TABLE  if not exists ChatSettings 
    (key_id INTEGER PRIMARY KEY AUTOINCREMENT, 
      chat_id INTEGER, Timezone TEXT, 
      UNIQUE (chat_id))`; 
  return new Promise(function(resolve, reject){
    db.run(sql, function(err) {
      if (err) {
        console.log(err.message); 
        reject(err); 
      } else { 
        console.log('table Expenses created\n');
        resolve(); 
      }
    }); 
  }).catch(err => {
    if (err) {
      console.log('createTableChatSettings error:', err); 
    }
  })
} 

function getTimezoneFromChatID(db, chatID) {
  const sql = 'SELECT Timezone FROM ChatSettings WHERE chat_id = ?'; 
  return new Promise (function(resolve, reject) {
    db.all(sql, chatID, function (err, rows){
      if (err) {
        console.log('getTimezoneFromChatID error: ',err); 
        reject(err); 
      }
      else {
        console.log('getTzFeomChatID, rows:', rows); 
        if (rows.length === 0) {
          console.log('getTimezoneFromChatID, no timezone for this chatID ', chatID); 
          resolve(0); 
        }
        else if (rows.length > 1) {
          console.log('more than 1 timezone record for this chatID', chatID); 
          resolve(rows[0].Timezone); 
        } else {
          console.log('getTimezoneFromChatID, found timezone: ', rows[0].Timezone); 
          resolve(rows[0].Timezone); 
        }
      }
    })
  })
}

function upsertRowIntoChatSettings(db, chatID, timezone)
{
  let sqlIns = `INSERT INTO ChatSettings (chat_id, Timezone) VALUES (?, ?)
    ON CONFLICT (chat_id) DO UPDATE SET Timezone = ?`;
  return new Promise(function (resolve, reject) { 
    db.run(sqlIns, [chatID, timezone,timezone], function(err) {
      if (err) {
        console.log('rejecting a promise')
        reject(err); 
      } else {
        console.log(`InsertRowIntoChatSettings: lastID ${this.lastID} changed: ${this.changes}`); 
        resolve(this); 
      }
    })
  })
} 

function selectTimezoneForChatID(db, chatID) {
  const sql = 'SELECT * FROM ChatSettings WHERE chat_id = ?'; 
  return new Promise (function(resolve, reject) {
    db.all(sql, chatID, function (err, rows){
      if (err) {
        console.log('selectTimezoneForChatID error: ',err); 
        reject(err); 
      }
      else {
        console.log('selectTimezoneForChatID, rows:', rows); 
        resolve(rows); 
      }
    })
  })
}



function createTableTags(db)
{
  const sql = 'CREATE TABLE IF NOT EXISTS Tags (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER, expense_id INTEGER, Tag TEXT)';
  return new Promise (function(resolve, reject) {
    db.run(sql, function(err) {
      if (err) {
        reject(err); 
      } else {
        console.log('Table Tags has been created'); 
        resolve(); 
      }
    })
  }) 
}

function createTableNames(db) {
  const sql = `CREATE TABLE IF NOT EXISTS Names 
    (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER,
     user_id INTEGER, userName TEXT, 
     UNIQUE (chat_id, user_id))
    `; 
  return new Promise((resolve, reject) => {
    db.run(sql, function(err){
      if (err) {
        console.log('error creating table Names:', err); 
        reject(err); 
      } else {
        console.log('table Names created'); 
        resolve(); 
      }
    })
  }).catch(err => {
    console.log('setNameForSender error:', err); 
  })
}

function createTableProgramSettings(db) {
  sql = `CREATE TABLE IF NOT EXISTS program_settings
    (id INTEGER PRIMARY KEY AUTOINCREMENT, 
      lastUpdate INTEGER, chatID INTEGER, 
      isMessage INTEGER, lastUpdateFinished INTEGER)`
     return sqlRun(db, sql); 
}

function getMessageOffset(db) {
  return new Promise((resolve, reject) => {
    sql = `SELECT * FROM  
    (SELECT * FROM program_settings ORDER BY id DESC LIMIT 2)
          ORDER BY id DESC`
    let messOffset = null;  
    let wasError = false; 
    db.all(sql, function(err, rows) {
      if (err){
        console.log('error getting message offset', err);
        reject(err); 
      } else {
        if (rows.length === 0) {
          messOffset = 0; 
          console.log('no rows in program_settings table, message offset', messOffset);
        } else if (rows.length === 1) {
          messOffset = (rows[0].lastUpdateFinished) ? (rows[0].lastUpdate + 1) : 
            rows[0].lastUpdate
        } else {
          if (rows[0].lastUpdateFinished) {
            messOffset = rows[0].lastUpdate + 1
          } else if (rows[0].lastUpdate === rows[1].lastUpdate) {
            messOffset = rows[0].lastUpdate + 1
            wasError = true
          } else {
            messOffset = rows[0].lastUpdate
          }
        }
        if (messOffset === null) {
          reject('message offset not found'); 
        } else {
          console.log('getMessageOffset offset:', messOffset)
          const objToResolve = (wasError ? {messOffset: messOffset, wasError: wasError, chatID: rows[0].chatID} : {messOffset: messOffset})
          console.log('object to resolve: ', objToResolve)
          resolve(objToResolve)
        }
      }
    })
  })
}

function updateMessageOffset(db, updateNumber, updateChatID) {
let sql = `UPDATE program_settings  SET lastUpdateFinished = (?)
  WHERE lastUpdate = (?) AND chatID = (?)`; 
  params = [1, updateNumber, updateChatID]
  console.log('going to update string in program settings, \nPARAMS for programSettings: ', params, '\nx = ', x)
  sqlRun(db, sql, params)
    .then(() => {
      console.log('info for update changed, params', params)
    })
    .catch(err => {
      console.log('error updating in program_settings', err)
      console.log('x =', x, 'data.result[x]: ', data.result[x])
    })
}

function sqlRun(db, sql, params) {
  return new Promise(function(resolve, reject) {
    db.run(sql, params, function(err) {
      if(err) {
        reject(err); 
      } else {
        console.log('number of rows changed by running sql: ', this.changes); 
        resolve(this); 
      }
    })
  })
}

function sqlAll(db, sql, params) {
  console.log('sqlAll started'); 
  return new Promise((resolve, reject) => {
    db.all(sql, params, function(err, rows){
      if (err) {
        console.log('sqlAll error', err); 
        reject(err); 
      } else {
        console.log('sqlAll going to resolve'); 
        resolve(rows); 
      } 
    })
  })
}

function closeDB(db)
{
    db.close((err) => {
        if (err) {
            return console.error(err.message);
        }
        console.log('Close the database connection'); 
    }) 
}

exports.openDB = openDB
exports.dropTable = dropTable
exports.alterTableAddSender = alterTableAddSender
exports.updateTable = updateTable
exports.createTableExpenses = createTableExpenses
exports.insertRowIntoExpenses = insertRowIntoExpenses
exports.deleteRowFromExpensesByMessageID = deleteRowFromExpensesByMessageID
exports.createTableCategories = createTableCategories
exports.insertRowIntoCategories = insertRowIntoCategories
exports.placeholdersForInsertRow = placeholdersForInsertRow
exports.selectAllFromCategories = selectAllFromCategories
exports.selectSortedCategoryKeywordFromCategories = selectSortedCategoryKeywordFromCategories
exports.selectFromTable = selectFromTable
exports.selectKeywordsFromCategories = selectKeywordsFromCategories
exports.deleteRowFromCategories = deleteRowFromCategories
exports.findCategoriesByWords = findCategoriesByWords
//exports.searchKeywordInCategories = searchKeywordInCategories
exports.addKeywordToCategories = addKeywordToCategories
exports.selectWhereFromExpenses = selectWhereFromExpenses
exports.selectWhereFromBeforeExpenses = selectWhereFromBeforeExpenses
exports.selectDistinctFromCategories = selectDistinctFromCategories
exports.selectSumByCategoriesFromExpenses = selectSumByCategoriesFromExpenses
exports.createTableChatSettings = createTableChatSettings
exports.getTimezoneFromChatID = getTimezoneFromChatID
exports.selectTimezoneForChatID = selectTimezoneForChatID
exports.upsertRowIntoChatSettings = upsertRowIntoChatSettings
exports.createTableTags = createTableTags
exports.createTableNames = createTableNames
exports.createTableProgramSettings = createTableProgramSettings
exports.getMessageOffset = getMessageOffset
exports.updateMessageOffset = updateMessageOffset
exports.sqlRun = sqlRun
exports.sqlAll = sqlAll
exports.closeDB = closeDB