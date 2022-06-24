//Dependencies and config.
let sDate = new Date()
let startTime = sDate.getTime()

require('dotenv').config({path:'./config.env'})
const {Client, Intents, MessageEmbed, User, Message, DiscordAPIError} = require('discord.js')

const parser = require('discord-command-parser');

const { Trello } = require("trello-helper");

const ARDtrello = new Trello({path : './bot_authkey.env.json'})

let rover = require('rover-api');

const { default: Bottleneck } = require('bottleneck');

const { prototype } = require('events');
var kfs = require('key-file-storage');
const botVersion = require('./package.json').version;
const { isNullOrUndefined } = require('util');
var axios = require('axios').default
const axiosRetry = require('axios-retry');
axiosRetry(axios,{retries:3, shouldResetTimeout:true, retryDelay: axiosRetry.exponentialDelay})
const { cursorTo } = require('readline');
const { time } = require('console');


//Initialise UTIL_STORE user info data storage

var S_DTR = require("key-file-storage").default('./UTIL_STORE/DR/',false)
var S_RTD = require("key-file-storage").default('./UTIL_STORE/RD/',false)
var S_RNK = require("key-file-storage").default('./UTIL_STORE/Ranks/',false)

//Initialise DS_STORE duty state storage

var S_PDS = require("key-file-storage").default('./DS_STORE/PendingDS/',true)
var S_ADS = require("key-file-storage").default('./DS_STORE/AcceptedDS/',false)
var S_DDS = require("key-file-storage").default('./DS_STORE/DeniedDS/',false)
var S_ARC = require("key-file-storage").default('./DS_STORE/ArchiveDS/',false)

//Initialise INST_GRADED_DS for instructor grading tracking.

var S_IGD = require("key-file-storage").default('./INST_GRADED_DS/',false)

//Initialise REPORTS past week's reports

var S_RPT = require("key-file-storage").default('./REPORTS/', false)

//Initialise ACTIVITY_LOGS for storing activity logs

var S_ACL = require("key-file-storage").default('./ACTIVITY_LOGS/',false)

//Initialise TRELLO_CACHE for card ID cache

var S_TCH = require("key-file-storage").default('./TRELLO_CACHE/',false)

//Initialise ACTIVITY_LOGS_MSGS for card ID cache

var S_ACM = require("key-file-storage").default('./ACTIVITY_LOGS_MSGS/',false)

//Initialise RISK_LIST, KOS_LIST and the SUBJECT_BLACKLIST (S_BLS) and ARD divisional blacklist (S_BLA) for the background check module - info from the AIA trello.

var S_KOS = require("key-file-storage").default('./KOS_LIST/',true)
var S_RSK = require("key-file-storage").default('./RISK_LIST/',true)
var S_BLS = require("key-file-storage").default('./SUBJECT_BLACKLIST/',true)
var S_BLA = require("key-file-storage").default('./DIVISION_BLACKLIST/',true)
//State flags

var FLAG_QUOTARESETINITIATED = false
var FLAG_NOREPORTSYET = false
var STATE_LASTCACHERESET = 0
var FLAG_STARTUPCOMPLETE = false
var FLAG_KOSREFRESH = false
//Rover rate limiter

var roverLimiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 1000
}) 

const roverFetch = roverLimiter.wrap(roverapipull)

async function roverapipull(username){
    let response = axios.get(`https://verify.eryn.io/api/roblox/${username}`)
    return response.users;
}

//Dutystate acceptor/denier rate limiter

var dsLimiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 100
})

var trelloAllCardLimiter = new Bottleneck({
    maxConcurrent: 1,
    mintime: 15000000
})

//discord init and login

const client = new Client({
    intents:[Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS]
})

client.login(process.env.BOT_TOKEN)



var userRole, adminRole

//Other shite

var ARDguildObject;
var logchannel; 
var DSchannel;

if(S_RPT['/'].length == 0){
    FLAG_NOREPORTSYET = true
    console.log('\nNo reports found from last reset.\n')
}


client.on('ready', ()=>{
    onReady()
})

async function onReady(){
    await client.channels.fetch(process.env.LOGS_CHANNEL_ID)
    logchannel = await client.channels.cache.get(process.env.LOGS_CHANNEL_ID)

    let startupEmbed = new MessageEmbed().setDescription('**Fetching channels...**').setColor(16776960)
    let startupmessage = await logchannel.send({embeds:[startupEmbed]}).catch((error) => {console.log(error)})

    startupEmbed = new MessageEmbed().setDescription('**Fetching pending duty states...**').setColor(16776960)
    await startupmessage.edit({embeds : [startupEmbed]}).catch((error) => {console.log(error)})
    //fetch pending DSes messages
    await client.channels.fetch(process.env.DS_CHANNEL_ID)
    DSchannel = client.channels.cache.get(process.env.DS_CHANNEL_ID)
    for(i in S_PDS['/']){
        try{
            await DSchannel.messages.fetch((S_PDS['/'])[i]).catch((error)=>{console.log(error)})}
            catch(error){

        }
    }

    startupEmbed = new MessageEmbed().setDescription('**Misc startup stasks...**').setColor(16776960)
    await startupmessage.edit({embeds : [startupEmbed]}).catch((error) => {console.log(error)})


    
    await client.guilds.fetch(process.env.ARD_DISCORD_ID)
    ARDguildObject = client.guilds.cache.get(process.env.ARD_DISCORD_ID)
    await client.guilds.cache.get(process.env.ARD_DISCORD_ID).roles.fetch(process.env.BOTUSER_ROLE).catch(error => console.log(error))
    await client.guilds.cache.get(process.env.ARD_DISCORD_ID).roles.fetch(process.env.BOTADMIN_ROLE).catch(error => console.log(error))

    userRole = client.guilds.cache.get(process.env.ARD_DISCORD_ID).roles.cache.get(process.env.BOTUSER_ROLE)
    adminRole = client.guilds.cache.get(process.env.ARD_DISCORD_ID).roles.cache.get(process.env.BOTADMIN_ROLE)
    let endTime = new Date().getTime()
    let timeTaken = endTime - startTime
    startupEmbed = new MessageEmbed().setDescription('**Started!**').setColor(3066993).setTimestamp(new Date().getTime()).setFooter('Took '+timeTaken+'ms').setFooter('ARD Grading Utility ' + 'v'+botVersion)
    await startupmessage.edit({embeds : [startupEmbed]}).catch((error) => {console.log(error)})
    FLAG_STARTUPCOMPLETE =  true
}

client.on('messageCreate', (message) => {
    onMessage(message)
})


async function onMessage(message){
    if(!FLAG_STARTUPCOMPLETE){
        return;
    }
    try{
        if(message.inGuild()){
        if(message.guildId == process.env.ARD_DISCORD_ID){
                    
        if (message.author.id == '438125419858886666' && message.embeds[0].description != null && message.channel.id == '895502246509412382'){
            let noerrors= true;
            let notfounderror = false;
            for(let embed of message.embeds){
                await parseClanLabs(embed.description,message).catch((error) => {
                                                                                    console.log(error);
                                                                                    noerrors=false;
                                                                                    notfounderror = (error == "_404")?true:false
                                                                                })
            }
            if(noerrors){
                message.react(':accept~1:913689460087083028').catch(error => console.log(error))
            }
            else{
                message.react(':denied:913689460082892820').catch(error => console.log(error))
                if(notfounderror){
                    message.channel.send("Please check for any misspellings on the trello card name(s).").catch(error => console.log(error))
                }
            }
           
        }

        if(message.channel.id == process.env.ACLOGS_CHANNEL_ID && message.content.toLowerCase().startsWith('username')){
            await logActivity(message).catch(error => console.log(error))
        }

        if(message.channel.id == process.env.DS_CHANNEL_ID && message.content.toLowerCase().startsWith('[ds]')){
            await markPending(message).catch(error => console.log(error))
        }
        let commandsplit = message.content.split(' ')
        let re = new RegExp(/[^a-zA-Z0-9]/g)

        //make sure the parsed values have no special chars
        for(i in commandsplit){
            if(commandsplit[i] != null){
                commandsplit[i] = commandsplit[i].replace(re,'')
            }
        }
        
        if (message.content.startsWith('.qt')){
            let targetID, pendingNo, AcceptedNo, DeniedNo, acMins, dsGraded
            if(commandsplit[1] == null){
                targetID = message.author.id
            }
            else{
                targetID = commandsplit[1]
                if(targetID.startsWith('<')){
                    targetID = targetID.substr(3,targetID.length-4)
                }
            }
            dsGraded = await getGradedDS(targetID)
            pendingNo = await getPendingDSesNumber(targetID)
            AcceptedNo = await getAcceptedDSesNumber(targetID)
            DeniedNo = await getDeniedDSesNumber(targetID)
            acMins = await getActivityMinutes(targetID)
            let attachment = (dsGraded>0)?('\nDuty states graded: '+dsGraded+'.'):'.'

            let dsNoEmbed = new MessageEmbed()
                                            .setDescription('**DSes and quota for <@' + targetID +
                                                '>:**\n'+'Accepted: '+AcceptedNo+
                                                '\nDenied: ' + DeniedNo + 
                                                '\nPending: '+pendingNo +
                                                '\nActivity minutes: '+acMins+' mins' +attachment)
                                            .setColor(7419530)
                                            .setTimestamp(new Date().getTime()).setFooter('ARD Grading Utility ' + 'v'+botVersion)
            message.reply({embeds:[dsNoEmbed]}).catch(error => console.log(error))

        }

        if(message.content.startsWith('.gcr')){
            genReport(message,commandsplit)
            discordLogAction('.gcr',message.author.id,'```'+message.content+'```')
        }

        if(message.content.startsWith('.qreset')){
            resetQuota(message,commandsplit).catch(error => console.log(error))
            discordLogAction('.qreset',message.author.id,'```'+message.content+'```')
        }

        if (message.content.startsWith('.gwr')){
            getWkReport(message,commandsplit).catch(error => console.log(error))
            discordLogAction('.gwr',message.author.id,'```'+message.content+'```')
        }
        if(message.content.startsWith('.acset')){
            discordLogAction('.acset',message.author.id,'```'+message.content+'```')
            if(commandsplit[1] != null && commandsplit [2] != null){
                modifyActivityMinutes(message,commandsplit[1],commandsplit[2])
            }
           
        }
        if (message.content.startsWith('.info')){
            sendVersionData(message)
            discordLogAction('.info',message.author.id,'Data was returned.')
        }
        if(message.content.startsWith('.bc')||message.content.startsWith('.fbc')){
           
            let splitcomm = message.content.split(' ')
            backgroundCheck(message,splitcomm[1]).catch((error) => {console.log(error)})
           
        }
            }
        }
    }
catch(error){
    try{
        console.log('\nError! reacting X!')
        message.react('❌').catch(error => console.log(error))
        console.log(error)
    }
    catch(error2){
        console.log(error + '\n\n\n--\n\n\n' + error2)
    }
}
}

client.on('messageDelete', (message)=>{
    if(!FLAG_STARTUPCOMPLETE){
        return;
    }
    if(message.channel.id == process.env.DS_CHANNEL_ID && message.content.toLowerCase().startsWith('[ds]')){
        purgeActiveDS(message).catch(error => console.log(error))
    }

    if(message.channel.id == process.env.ACLOGS_CHANNEL_ID){
        purgeACLog(message).catch(error => console.log(error))
    }
})


client.on('messageReactionAdd',  async function (reaction,user) {
    if(!FLAG_STARTUPCOMPLETE){
        return;
    }
    if (reaction.message.channel.id != process.env.DS_CHANNEL_ID){
        return
    }
    let CurrentGMember = await GetGuildMember(user.id)
    if(CurrentGMember.roles.resolve(adminRole.id) || CurrentGMember.roles.resolve(userRole.id)){
        if(reaction.emoji.id == '913689460087083028'){
             
            if(await dsHandler(reaction.message.id,true,reaction,user.id)){
                reaction.message.react('🆗')
                discordLogAction('Accepted duty state',user.id,'DS message: '+reaction.message.id+'\nDS from: <@'+reaction.message.author.id+'>')
                .catch(error => console.log(error))
            }
        }
        else if(reaction.emoji.id == '913689460082892820'){
            if(await dsHandler(reaction.message.id,false,reaction,user.id)){
                reaction.message.react('🆗')
                discordLogAction('Denied duty state',user.id,'DS message: '+reaction.message.id+'\nDS from: <@'+reaction.message.author.id+'>')
                .catch(error => console.log(error))
            }
        }

        
    }
})


//--------------------------------------
//Internal-review dumping functions here
//--------------------------------------



//Points-Sync Feature functions

async function parseClanLabs(description,message){

    if(!description.includes('->')){
        console.log('\nFailed to get description.\n')
        throw "_ND"
    }

    // Clanlab's format is "username: initialpoints -> finalpoints\n..."

    let parse = description.split(' -> ')
    let parse2 = parse[0].split(':')
    let username = parse2[0].substr(2,parse2[0].length-2)
    let parse3 = parse[1].split('\n')

    let points = parse3[0]


    if(username.startsWith('**')){
        username = username.substr(2)
    }

    let _cardID = await UTIL_getCardIDfromUsername(username.trim())
    if (isNullOrUndefined(_cardID) ||  _cardID == "_404"){
        message.reply("`"+username.trim() + "` was not found. `[_404]`").catch(error => console.log(error))
        throw "_404";
    }

    await ARDtrello.setCustomFieldValueOnCard({cardFieldObj:{cardId:_cardID,fieldId:process.env.POINTS_CFIELD_ID},type:"number",value:points.trim()})
    .catch((error) => {throw "_UERR";})

}
//Activity log functions

//This is the function to push logs into memory
async function logActivity(message){
    let parsedLines = message.content.split('\n')
    if(parsedLines[1] == null || parsedLines[2] == null){
        return 
    }
    let timestartedLine = parsedLines[1]
    let timeendedLine = parsedLines[2]
    let HRtimestarted = (((timestartedLine.split(':'))[1]+':'+(timestartedLine.split(':'))[2]).trim()).substr(0,5)
    let HRtimeended = (((timeendedLine.split(':'))[1]+':'+(timeendedLine.split(':'))[2]).trim()).substr(0,5)
    console.log(HRtimestarted)
    console.log(HRtimeended)
    let hoursandminutesST = HRtimestarted.split(':')
    let hoursandminutesED = HRtimeended.split(':')

    let hourspassed = parseInt(hoursandminutesED[0])-parseInt(hoursandminutesST[0])
    let minutespassed = parseInt(hoursandminutesED[1])-parseInt(hoursandminutesST[1])
    if(!Number.isInteger(hourspassed) || !Number.isInteger(minutespassed) || parseInt(hoursandminutesED[0]) > 23 || parseInt(hoursandminutesED[0]) <0 || parseInt(hoursandminutesED[1]) >60 || parseInt(hoursandminutesED[1]) < 0 || parseInt(hoursandminutesST[0]) > 23 || parseInt(hoursandminutesST[0]) <0 || parseInt(hoursandminutesST[1]) >60 || parseInt(hoursandminutesST[1]) < 0 ){
        message.react(':denied:913689460082892820').catch(error => console.log(error))
        return  
    }
    if(hourspassed<0){
        hourspassed+=24
    }

    
    if(minutespassed<0){
        minutespassed+=60
        hourspassed--
    }
    if(hourspassed<0){
        hourspassed+=24
    }

    if(hourspassed>=24 || minutespassed>=60){
        message.react(':denied:913689460082892820').catch(error => console.log(error))
        return
    }

    if(S_ACL[message.author.id] == null){
        S_ACL[message.author.id] = (hourspassed*60+minutespassed)
        S_ACM[message.id] = message.author.id + '-' +(hourspassed*60+minutespassed)
    }
    else{
        S_ACL[message.author.id] = parseInt(S_ACL[message.author.id]) + (hourspassed*60+minutespassed)
        S_ACM[message.id] = message.author.id + '-' +(hourspassed*60+minutespassed)
    }
    message.react(':accept~1:913689460087083028').catch(error => console.log(error))
    
}

async function getActivityMinutes(userID){
    if(S_ACL[userID] == null){
        return 0
    }
    else{
        return parseInt(S_ACL[userID])
    }
}

async function modifyActivityMinutes(message,userID,value){
    if(!(message.author.id == '_MM')){
        let CurrentGMember = await GetGuildMember(message.author.id).catch(error=>console.log('modifyActivityMinutes() -> _ERR'))
        if(!CurrentGMember.roles.resolve(userRole.id) && !CurrentGMember.roles.resolve(adminRole.id)){
            message.reply('You do not have permission to run this command!').catch(error => console.log(error))
            return
        }
    }
    if(userID.startsWith('<')){
        userID = userID.substr(3,userID.length-4)

    }
    let currentmins
    if(isNaN(value)){
        message.react(':denied:913689460082892820').catch(error => console.log(error))
        return
    }
    value = parseInt(value)
    
    if(S_ACL[userID] == null){
        currentmins = 0
        if(value <= 0){
            message.reply('The user did not have any minutes logged anyway.').catch(error => console.log(error))
            return
        }
        else{
            S_ACL[userID] = value
        }
    }
    else{
        currentmins = S_ACL[userID]
        if(value<=0){
            S_ACL[userID] = undefined
        }
        else{
            S_ACL[userID] = value
        }
    }

    if(currentmins>0 && value <= 0){
        message.reply('Removed the user\'s logged activity. `' + currentmins + '-> 0`').catch(error => console.log(error))
    }
    else{
        message.reply('Set the user\'s logged activity: `'+currentmins+' -> '+value+'`').catch(error => console.log(error))
    }

    message.react(':accept~1:913689460087083028').catch((error => console.log(error)))
}
//Duty states and quota manager functions


//accept and deny DSes with ratelimiter (dsLimiter from Bottleneck) to prevent reaction spam

async function resetQuota(message,parsed){
    let CurrentGMember = await GetGuildMember(message.author.id)
    if(!CurrentGMember.roles.resolve(adminRole.id)){
        message.reply('You do not have permission to run this command!').catch(error => console.log(error))
        return
    }
    
    if(FLAG_QUOTARESETINITIATED){
        if(parsed[1] == 'confirm'){
            let report_a = await genReport(message,[' ','a'])
            let report_r = await genReport(message,[' ','r'])
            let report_sr = await genReport(message,[' ','sr'])
            let report_i = await genReport(message,[' ','i'])
            let report_s = await genReport(message,[' ','s'])

            S_RPT['a'] = report_a
            S_RPT['r'] = report_r
            S_RPT['sr'] = report_sr
            S_RPT['i'] = report_i
            S_RPT['s'] = report_s

            new S_ADS('*')
            new S_DDS('*')
            if ((S_PDS['/'])[0] != undefined){
                for(i in S_PDS['/']){
                    try{
                        await DSchannel.messages.fetch((S_PDS['/'])[i]).catch(error => console.log(error))
                        let messagex = await DSchannel.messages.cache.get((S_PDS['/'])[i]).catch(error => console.log(error))
                        messagex.react('🔴').catch(error => console.log(error))
                    }
                    catch(error){
                        console.log(error)
                    }
                }
            }
          

            new S_PDS('*')
            new S_ACL('*')
            new S_IGD('*')
            new S_ACM('*')
        }

        else{
            message.reply('Incorrect format. Type `.qreset confirm` to confirm a reset').catch(error => console.log(error))
            return
        }
    }
    else{
        FLAG_QUOTARESETINITIATED = true
        message.reply('**Quota reset initiated!** Type `.qreset confirm` in the next 10 seconds to confirm the quota reset, generate all rank reports, and purge duty state cache.').catch(error => console.log(error))
        setTimeout(() => {FLAG_QUOTARESETINITIATED = false}, 10000)
    }
}

async function dsHandlerRaw(messageID,DSstatus,reaction,userID){ 
    if(!S_PDS[reaction.message.id]){
        return false //if the DS doesn't exist in the store, don't do anything.
    }

    if(DSstatus){
        let user = S_PDS[messageID]
        if(S_ADS[user]!=''){
            S_ADS[user] = S_ADS[user] + '-'
        }
        S_ADS[user] = S_ADS[user] + messageID

        
    }

    if(!DSstatus){
        let user = S_PDS[messageID]
        if(S_DDS[user]!=''){
            S_DDS[user] = S_DDS[user] + '-'
        }
        S_DDS[user] = S_DDS[user] + messageID

        
    }

    S_PDS[messageID] = undefined

    if(S_IGD[userID] == null){
        S_IGD[userID] = 1
    }
    else{
        S_IGD[userID] = parseInt(S_IGD[userID]) + 1
    }
    return true
}

var dsHandler = dsLimiter.wrap(dsHandlerRaw)

async function getPendingDSesNumber(userID){
    let pendingnumber = 0
    for (let countergpdsn in S_PDS['/']){
        if(S_PDS[ (S_PDS['/'])[countergpdsn]] == userID ){
            pendingnumber++
        }
    }
    return pendingnumber
}

async function getAcceptedDSesNumber(userID){
    if(S_ADS[userID]==null){
        return 0
    }
   let counterdadsn = S_ADS[userID].split('-')
   if(counterdadsn.length == -1 || counterdadsn.length == 0 || (counterdadsn.length == 1 && (counterdadsn[0] == null || counterdadsn[0] == 'null'))){
       return 0
   }
   else{
       return counterdadsn.length-1
   }
}

async function getDeniedDSesNumber(userID){
    let S_DDS= kfs.default('./DS_STORE/DeniedDS')
    if(S_DDS[userID]==null){
        return 0
    }
    let countergddsn = S_DDS[userID].split('-')
    if(countergddsn.length == -1 || countergddsn.length == 0 || (countergddsn.length == 1 && (countergddsn[0] == null || countergddsn[0] == 'null'))){
        return 0
    }
    else{
        return countergddsn.length-1
    }
    
 }



async function purgeActiveDS(message){
    delete S_PDS[message.id]
    S_ARC[message.id] = message.author.id + '-deleted-' + new Date().getTime()
}

//removes activity minutes if someone deletes a log.
async function purgeACLog(message){
    for(let log of S_ACM['/']){
        if(log == message.id){
            let parsed = S_ACM[log].split('-')
            let currentmins = await getActivityMinutes(parsed[0])
            currentmins = currentmins - parseInt(parsed[1])
            let mockmessage = {
                reply: async (a) => {console.log('mockMessage- '+a)},
                react: async (b) => {console.log('mockReacting- ' + b)},
                author:{
                    id:'_MM'
                }
            } //So that we don't error out.

            await modifyActivityMinutes(mockmessage, parsed[0], currentmins)
            S_ACM[log] = undefined
        }
    }
}

async function markPending(message){
    S_PDS[message.id] = message.author.id
    try{
        message.react(':accept~1:913689460087083028').then(message.react(':denied:913689460082892820').catch(error => console.log(error))).catch(error => console.log(error))
    }
    catch(error){
        console.log(error)
    }
    
}

async function getGradedDS(userID){
    if(S_IGD[userID] == null){
        return 0
    }
    else{
        return parseInt(S_IGD[userID])
    }
}

async function getWkReport(message,parsed){
    let CurrentGMember = await GetGuildMember(message.author.id)
    if(!CurrentGMember.roles.resolve(adminRole.id)){
        message.reply('You do not have permission to run this command!').catch(error => console.log(error))
        return
    }
    if(!parsed[1]){
        message.reply('No rank provided!').catch(error => console.log(error))
        return
    }
    let targetRank
    switch(parsed[1].toLowerCase()){
        case 'a': 
        case 'r': 
        case 'sr': 
        case 'i' : 
        case 's': targetRank = parsed[1]
        break;
        default: message.reply('Invalid rank! Valid options are: `A,R,SR,I,S`').catch(error => console.log(error))
    }
    if(S_RPT[targetRank] == null){
        message.reply('No report found for that rank!').catch(error => console.log(error))
        return
    }
    let oldWkReportEmbed = new MessageEmbed().setDescription(S_RPT[targetRank]).setColor(10181046).setFooter('ARD Grading Utility ' + 'v'+botVersion)
    message.reply({embeds:[oldWkReportEmbed]}).catch(error => console.log(error))
}

async function genReport(message,parsed){
    let CurrentGMember = await GetGuildMember(message.author.id)
    if(!CurrentGMember.roles.resolve(adminRole.id)){
        message.reply('You do not have permission to run this command!').catch(error => console.log(error))
        return
    }
    if(parsed[1] == null){
        message.reply('No rank specified!').catch(error => console.log(error))
        return
    }
    let targetRankID
    switch(parsed[1].toLowerCase()){
        case 'a': targetRankID = process.env.RANK_A
        break;
        case 'r': targetRankID =  process.env.RANK_R
        break;
        case 'sr': targetRankID = process.env.RANK_SR
        break;
        case 'i' : targetRankID = process.env.RANK_I
        break;
        case 's': targetRankID = process.env.RANK_S
        break;
        default: message.reply('Invalid rank! Valid options are: `A,R,SR,I,S`').catch(error => console.log(error)); return undefined;
    }
    await client.guilds.fetch(process.env.ARD_DISCORD_ID)
    let memberList,returned;
    returned = 'DSes and quotas:'
    await ARDguildObject.roles.fetch(targetRankID).catch(error => console.log('no rank ID'))
    if(!ARDguildObject.roles.cache.get(targetRankID)){
        console.log('no rank ID found')
        message.channel.send('Rank ID not set up!').catch(error => console.log(error))
        return
    }
    await ARDguildObject.members.fetch()
    memberList = ARDguildObject.roles.cache.get(targetRankID).members.map(m=>m.id)
    
    for(i in memberList){
        console.log(memberList[i])
        let AccDS = await getAcceptedDSesNumber(memberList[i])
        let ActvMins = await getActivityMinutes(memberList[i])
        let attachment = '.'
        if (parsed[1].toLowerCase() == 'i' || parsed[1].toLowerCase() == 's'){
            let DSGraded = await getGradedDS(memberList[i])
            attachment = ' and ' + DSGraded + ' DS graded.'
        }
        returned = returned + '\n<@' + memberList[i] + '>: ' + AccDS + ' DSes and ' + ActvMins + ' mins of activity logs' + attachment
    }

    let DSReportembed = new MessageEmbed().setDescription(returned).setTimestamp(new Date().getTime()).setColor(10181046).setFooter('ARD Grading Utility ' + 'v'+botVersion)
    message.channel.send({embeds: [DSReportembed]}).catch(error => console.log(error))
    return returned
} 


//for (const [key,value] of collection){...}

//Util functions

async function GetGuildMember(userID){
    await client.guilds.cache.get(process.env.ARD_DISCORD_ID).members.fetch(userID)
    return client.guilds.cache.get(process.env.ARD_DISCORD_ID).members.cache.get(userID)
}

async function sendVersionData(message){
    let package = require('./package.json')
    let dependencies
    for(i in package.dependencies){
        dependencies = dependencies + '\n' + i + ': ' +package.dependencies[i].replace('^','v')

    }
    let version = botVersion
    let nVersion = process.version
    let name = package.name
    let sTime = sDate.toUTCString()

    let reply = new MessageEmbed()
                    .setAuthor(name)
                    .setDescription('**Version: '+version+'\nStarted at: '+sTime+'**\n\n**Dependencies:**```' + dependencies.replace('undefined','') + '```\n' + '**Settings:**\n'+'Points channel: <#'+process.env.POINTS_CHANNEL_ID+'>\nActivity logs channel: <#'+process.env.ACLOGS_CHANNEL_ID+'>\nDuty states channel: <#'+process.env.DS_CHANNEL_ID+'>\nLogging: <#'+process.env.LOGS_CHANNEL_ID+'>\nUser role: <@&'+process.env.BOTUSER_ROLE+'>\nAdmin role: <@&'+process.env.BOTADMIN_ROLE+'>')
                    .setFooter('Node ' + nVersion)
                    .setTimestamp(new Date().getTime())
    message.reply({embeds:[reply]}).catch(error => console.log(error))
}

//awaitable timeout function in Javascript because I might need it

function timeout(delay){
    return new Promise(resolve => setTimeout(resolve,delay))

}




//Pointless wrappers 


async function UTIL_getCardIDfromUsername(robloxUsername){
    let listCards


    if(S_TCH[robloxUsername] == null){
        listCards = await ARDtrello.getCardsOnList({listId: process.env.AR_LIST_ID}).catch((error)=>{console.log(error)})
        for(i in listCards){
            S_TCH[listCards[i].name]=listCards[i].id
            if(listCards[i].name == robloxUsername){
                return listCards[i].id
            }
        }

        listCards = await ARDtrello.getCardsOnBoard({boardId: process.env.ARD_TRELLO_BOARD_ID}).catch((error)=>{console.log(error)})
        for (i in listCards){
            S_TCH[listCards[i].name]=listCards[i].id
            if(listCards[i].name == robloxUsername){
                return listCards[i].id
            }
        }
    }
    else{
        return S_TCH[robloxUsername]
    }

    return "_404" //Not found
}

async function discordLogAction(action,userid,description){
    let logEmbed = new MessageEmbed().setAuthor(action).setFooter('User: '+userid).setDescription(description).setTimestamp(new Date().getTime())
    logchannel.send({embeds:[logEmbed]})
}

//background check features

async function backgroundCheck(message, username, permsdetails=false){
    let CurrentGMember = await GetGuildMember(message.author.id).catch(error=>console.log('modifyActivityMinutes() -> _ERR'))
    if(message.content.toLowerCase().startsWith('.fbc')){
        if(!CurrentGMember.roles.resolve(userRole.id) && !CurrentGMember.roles.resolve(adminRole.id)){
            message.reply('You do not have permission to run this command!').catch(error => console.log(error))
            return
        }
        else{
            permsdetails = true
        }
    } 

    if(FLAG_KOSREFRESH == true){
        message.reply("KoS list being refreshed... Please wait (~15 seconds)!").catch((error) =>  {console.log(error)})
        setTimeout(backgroundCheck(message,username,permsdetails), 15000);
    }
    
    
    let userID = await UTIL_getUserID(username).catch((error) => {
        message.reply("Error while checking for the user ID. Is it valid?")
        return;
    })
    let accountInfo = await UTIL_getAccountInfo(userID).catch((error) => {
        message.reply("Error while fetching account data.")
        return;
    })
    let initialEmbed = new MessageEmbed().setDescription("<a:cog:951508668283748386> Checking details...").setColor(16776960)
    let sentMsg = await message.channel.send({embeds:[initialEmbed]})
    if(userID == undefined || userID == null || username === undefined || username === null ){
        message.reply("Error while checking for the user ID. Is it valid?")
        sentMsg.delete()
        return;
    }
    initialEmbed.setDescription("<a:cog:951508668283748386> Checking historical KoS status...")

    let returnedDetails = new MessageEmbed().setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${userID}&width=420&height=420&format=png`)

    let friends = await UTIL_fetchFriends(userID)

    let previousUsernames = await UTIL_fetchPreviousUsernames(userID)

    let timecreated = Date.parse(accountInfo.created)
    let ctime = new Date().getTime()
    let AgeCheckPassed = ((ctime-timecreated)>15778800000)
    let badges = await UTIL_getBadges(userID)
    let DODBadgeCount = 0
    for(i in badges){
        if(badges[i].startsWith('[The Border]')){
            DODBadgeCount++
        }
    }
    let safetypoints = 60
    let KOS = "No"
    let RSK = "No"
    let BLS = "No"
    let BLA = "No"
    let usernamechecknoerrors = true
    let descriptionReturned = "**Background info of `"+username+"`:**\n\n"
                            + "Display name: "+accountInfo.displayName 
                            + "\nCreated: <t:"+(timecreated+" ").slice(0,10) +":R>"+"\nFriend count: " + friends.length
                            + "\nBadge count: " + badges.length
                            + "\nBadges from DoD: " + DODBadgeCount

    if (previousUsernames[0]!=null){
        descriptionReturned=descriptionReturned+"\nPrevious Usernames: ```\n"
        for(i in previousUsernames){
            descriptionReturned = descriptionReturned + previousUsernames[i] + '\n'
        }
        descriptionReturned = descriptionReturned + "\n```\n"
    }
    returnedDetails.setDescription(descriptionReturned).setColor(16777215)
    await sentMsg.edit({embeds:[returnedDetails,initialEmbed]})
    let usernameChecks = []
    let returnedMain = await UTIL_checkBlacklists(username)
    usernameChecks.push(returnedMain)
    for(i in previousUsernames){
        let returnedPrev = await UTIL_checkBlacklists(previousUsernames[i])
        usernameChecks.push(returnedPrev)
    }
    for(i in usernameChecks){
        if(usernameChecks[i].KOS != "_none" && KOS == "No"){
            KOS = `Found: [link to card](https://trello.com/c/${usernameChecks[i].KOS})`
        }
        if(usernameChecks[i].RSK != "_none" && RSK == "No"){
            RSK = `Found: [link to card](https://trello.com/c/${usernameChecks[i].RSK})`
        }
        if(usernameChecks[i].BLS != "_none" && BLS == "No"){
            BLS = `Found: [link to card](https://trello.com/c/${usernameChecks[i].BLS})`
        }
        if(usernameChecks[i].BLA != "_none" && BLA == "No"){
            BLA = `Found: [link to card](https://trello.com/c/${usernameChecks[i].BLA})`
        }
    }
    let safedescription = "**Subject Evaluation:**\nCLEAR"
    descriptionReturned = "**KOS status:**\nKOS: "+KOS+"\nRisk: "+RSK + "\nSubject blacklist: " + BLS + "\nDivisional Blacklist: "+ BLA
    
    let embedcolour = 3066993
    if(RSK != "No" || BLA != "No"){
        embedcolour = 16776960
        if(!permsdetails){
            safedescription = "**Subject Status:**\nRISKY"
        }
    }
    if(KOS != "No" || BLS != "No"){
        embedcolour = 15158332
        if(!permsdetails){
            safedescription = "**Subject Status:**\nDENIED"
        }
    }
    if(!AgeCheckPassed){
        safedescription = safedescription + "\nWarning: Account less than 6 months old."
        descriptionReturned = descriptionReturned + "\nWarning: Account less than 6 months old."
        safetypoints-=20
    }
    if(friends.length < 20){
        safedescription = safedescription + "\nWarning: Low friend count."
        descriptionReturned = descriptionReturned + "\nWarning: Low friend count."
        safetypoints-=20
    }
    if((DODBadgeCount/badges.length)>=0.5 || badges.length <10){
        safedescription = safedescription + "\nWarning: They don't have a lot of badges outside of DoD."
        descriptionReturned = descriptionReturned + "\nWarning: They don't have a lot of badges outside of DoD."
        safetypoints-=20
    }

    if(safetypoints<=40){
        embedcolour = 16776960
    }
    if(safetypoints<=20){
        embedcolour = 15158332
    }


    let blCheckEmbed = new MessageEmbed()
                        .setDescription((permsdetails)?descriptionReturned:safedescription)
                        .setColor(embedcolour).setFooter('ARD Grading Utility ' + 'v'+botVersion)
                        .setTimestamp(new Date().getTime())
    await sentMsg.edit({embeds:[returnedDetails,blCheckEmbed]}).catch(error => {console.log(error)})
}
async function UTIL_getUserID(robloxUsername){
    let noerrors = true
    let response = await axios.get(`https://api.roblox.com/users/get-by-username?username=${robloxUsername}`).catch((error)=>{console.log(error);noerrors = false})
    return (noerrors)?response.data.Id:"_ERR"

}
async function UTIL_getGamepasses(){
    //get gamepasses from DOD and outside and tally the value of DOD passes.
}
async function UTIL_getBadges(robloxID){
    //return badges from DOD and outside [noblox if possible]
    let noerrors = true
    let dataarray = []

    let response = await axios.get(`https://badges.roblox.com/v1/users/${robloxID}/badges?limit=100&sortOrder=Asc`).catch((error)=>{console.log(error);noerrors = false})
    while(noerrors){
        for(i in response.data.data){
            dataarray.push(response.data.data[i].name)
        }
        if(response.data.nextPageCursor != null){
            response = await axios.get(`https://badges.roblox.com/v1/users/${robloxID}/badges?limit=100&cursor=${response.data.nextPageCursor}&sortOrder=Asc`).catch((error)=>{console.log(error);noerrors = false})
        }
        else{
            break;
        }
    }
    return (noerrors)?dataarray:"_ERR"
}

async function UTIL_getAccountInfo(robloxID){
    //return account age [noblox if i can, or axios]
     let noerrors = true
    let response = await axios.get(`https://users.roblox.com/v1/users/${robloxID}`).catch((error)=>{console.log(error);noerrors = false})
    return (noerrors)?response.data:"_ERR"

    
}


async function UTIL_fetchPreviousUsernames(robloxID){
    //return previous usernames
    let noerrors = true
    let dataarray = []
    let response = await axios.get(`https://users.roblox.com/v1/users/${robloxID}/username-history?limit=100&sortOrder=Asc`).catch((error)=>{console.log(error);noerrors = false})
    while(noerrors){
        for(i in response.data.data){
            dataarray.push(response.data.data[i].name)
        }
        if(response.data.nextPageCursor != null){
            response = await axios.get(`https://users.roblox.com/v1/users/${robloxID}/username-history?limit=100&cursor=${response.data.nextPageCursor}&sortOrder=Asc`).catch((error)=>{console.log(error);noerrors = false})
        }
        else{
            break;
        }
    }
    return (noerrors)?dataarray:"_ERR"
}

async function UTIL_fetchFriends(robloxID){
    //return friends list [Roblox API v2]
    let friends = []
    let page=1
    let nobreak = true
    let noerrors = true
    while(noerrors && nobreak){
        let response = await axios.get(`https://api.roblox.com/users/${robloxID}/friends?page=${page}`).catch((error)=>{console.log(error);noerrors = false})
        if(response.data.length == 0){
            nobreak = false
        }
        else{
            for(i in response.data){
                friends.push(response.data[i])
            }
            page++
        }

    }

    return (noerrors)?friends:"_ERR"
}


async function UTIL_checkBlacklists(robloxUsername){
    //no HTTP reqs needed - use only the caches
    let hits = {
        KOS:"_none",
        RSK:"_none",
        BLS:"_none",
        BLA:"_none"

    }
    for(i in S_KOS['/']){
        if((S_KOS['/'])[i]==robloxUsername){
            
            hits.KOS = S_KOS[(S_KOS['/'])[i]]
        }
    }
    for(i in S_RSK['/']){
        if((S_RSK['/'])[i]==robloxUsername){
            
            hits.RSK = S_RSK[(S_RSK['/'])[i]]
        }
    }
    for(i in S_BLS['/']){
        if((S_BLS['/'])[i]==robloxUsername){
            
            hits.BLS = S_BLS[(S_BLS['/'])[i]]
        }
    }
    for(i in S_BLA['/']){
        if((S_BLA['/'])[i]==robloxUsername){
            
            hits.BLA = S_BLA[(S_BLA['/'])[i]]
        }
    }
    return hits;
}

async function refreshKOS(){
  try{
    FLAG_KOSREFRESH = true
    let AIAlistcards = null
    let rkosnoerrors = true
    //fetch the KoS list, and store it in the local cache at ./KOS_LIST - and do the same for ./RISK_LIST from the Risk Individual list.
    AIAlistcards = await ARDtrello.getCardsOnList({listId: process.env.KOS_LIST_ID}).catch((error)=>{console.log(error);rkosnoerrors = false})
    if(!rkosnoerrors){
        FLAG_KOSREFRESH = false
        return;
    }

    delete S_KOS['*']
    for (i in AIAlistcards){
        AIAlistcards[i].name = AIAlistcards[i].name.replace('/',' ')
        S_KOS[AIAlistcards[i].name]=AIAlistcards[i].shortLink
    }

    AIAlistcards = null

    AIAlistcards = await ARDtrello.getCardsOnList({listId: process.env.RISK_LIST_ID}).catch((error)=>{console.log(error);rkosnoerrors = false})
    if(!rkosnoerrors){
        FLAG_KOSREFRESH = false
        return;
    }

    delete S_RSK['*']
    for (i in AIAlistcards){
        AIAlistcards[i].name = AIAlistcards[i].name.replace('/',' ')
        S_RSK[AIAlistcards[i].name]=AIAlistcards[i].shortLink
    }

    AIAlistcards = null
  

    AIAlistcards = await ARDtrello.getCardsOnList({listId: process.env.SUB_BLACKLIST_ID}).catch((error)=>{console.log(error);rkosnoerrors = false})
    if(!rkosnoerrors){
        FLAG_KOSREFRESH = false
        return;
    }

    delete S_BLS['*']
    for (i in AIAlistcards){
        AIAlistcards[i].name = AIAlistcards[i].name.replace('/',' ')
        S_BLS[AIAlistcards[i].name]=AIAlistcards[i].shortLink
    }

    AIAlistcards = null
    AIAlistcards = await ARDtrello.getCardsOnList({listId: process.env.DIV_BLACKLIST_ID}).catch((error)=>{console.log(error);rkosnoerrors = false})
    if(!rkosnoerrors){
        FLAG_KOSREFRESH = false
        return;
    }

    delete S_BLA['*']
    for (i in AIAlistcards){
        AIAlistcards[i].name = AIAlistcards[i].name.replace('/',' ')
        S_BLA[AIAlistcards[i].name]=AIAlistcards[i].shortLink
    }

    AIAlistcards = null
    FLAG_KOSREFRESH = false
    
  }
  catch(error){
      console.log("Unable to update KoS lists.\n\n"+error)
  }
  setTimeout(() => {console.log('List refreshed, waiting 30 minutes.');refreshKOS()},1800000)
}
refreshKOS()