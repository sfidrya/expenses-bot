const axios = require('axios'); 

function sendCommand(command, data) {
  const token = process.env.RECEIPTS_BOT_TOKEN; 
  const tokenEncoded = encodeURIComponent(token); 
  return axios({
    method: 'post', 
    url: `https://api.telegram.org/bot${tokenEncoded}/${command}`, 
    data: data
  })
}

function sendMessage(chatID, text) {
  return sendCommand('sendMessage', {
    chat_id: chatID, 
    text: text, 
    timeout: 100
  })
  .then(response =>  {var data = response.data; 
      console.log('sendMessage after sending message', data); 
      return data;  
  })
  .catch(function(err){
    console.log('sendMessage error in axios: ', err);
    return err; 
  })
}

exports.sendCommand = sendCommand 
exports.sendMessage = sendMessage