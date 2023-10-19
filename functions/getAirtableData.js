const Airtable = require('airtable');
const StvBase = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base('appJLPNSIXnunD5Qn');
const RbtvBase = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base('appTDzZIAs6Mp5rKR');

async function getAirtableData(dateorid) {
    //let [formattedDate] = date.toISOString().split('T')
    //console.log('formatted Date: ' + formattedDate)
    let result;

    //get time values for single record
    if(dateorid.toString().startsWith('AA')) {
        result = await getStvRecordbyid(dateorid)
    }
    else if (dateorid.toString().startsWith('rrn')){
        result = await getRbtvRecordById(dateorid)
    }
    else
        await Promise.all([
            //get RBTV Array [0]
            getRbtvRecords(dateorid),
            //get STV Array [1]
            getStvRecords(dateorid)
        ]).then(res => {
            //console.log(res)
            result = res
        }).catch(function (err){
            console.log(err);
        });

    return result;

}

async  function checkEaseLive(id){

    if(!id.toString().startsWith('AA'))
        return "false"

    let url = 'https://dms.redbull.tv/v5/destination/stv/'+id+'/personal_computer/http/us/en/playlist.json';

    let jsonEndpoint= await fetch(url)
        .then(res => res.json())
        .then(out => out.easeLive)
        .catch(err => "false");

    console.log(jsonEndpoint)

    let record = await StvBase('Streams').select({
        returnFieldsByFieldId: true,
        fields: ["fldLe62fH8jixHnDY","fld99COgTip7RUSyY", "fldFFbZqNyiAbaL4g", "flde4AmtrtaSWluTw", "fld9nt3OYKXtrt9Wx"],
        filterByFormula: `FIND('${id}', {(CR) AA-ID})`
    }).all().then(res => {console.log(res.length); return res[0]})

    record = {"id": record.get('fldLe62fH8jixHnDY').trim(),"accountId": record.get("fld9nt3OYKXtrt9Wx"),"projectId": record.get("fldFFbZqNyiAbaL4g"),"programId": record.get("flde4AmtrtaSWluTw"), "active": record.get('fld99COgTip7RUSyY')||false}

    console.log(record)

    if(record.active ===true){
        if(record.accountId === jsonEndpoint.accountId && record.projectId === jsonEndpoint.projectId && record.programId ===jsonEndpoint.programId && record.active===jsonEndpoint.active && record.id === jsonEndpoint.programId){
            return "Active and setup is correct"
        }else{
            return "Active but incorrect setup -> check in LOT"
        }
    }else{
        return "false"
    }
}

async  function getStvRecordbyid(id){
    let result = [];
    let record = await StvBase('Streams').select({
        returnFieldsByFieldId: true,
        fields: ["fldLe62fH8jixHnDY","fld0u3iJmSxKXo8BI","fldRpqqfO2pNvfPbs","fld0BvKidQNUw8wdR"],
        filterByFormula: `FIND('${id}', {(CR) AA-ID})`
        //filterByFormula: "AND({(CR) AA-ID} = '" + id + "', NOT({(CR) Start Event local time (24h)} = ''))"
        //what if no start/end times? maybe use default value instead of filtering out? checked what happens if wrong id is entered - nothing is displayed no error
        //reduce to only used/needed fields fields: [] done
        //maybe add field restriction to reduce parsed data done
    }).all().then(res => {console.log(res.length); return res[0]})

    //records is array

    result = {"id": record.get('fldLe62fH8jixHnDY').trim(), "start": record.get('fld0u3iJmSxKXo8BI')||"no Value", "end": record.get('fldRpqqfO2pNvfPbs')||"no Value", "atlink": record.get('fld0BvKidQNUw8wdR').url}


    return result
}

async  function getRbtvRecordById(id){

    let result = [];
    let record = await RbtvBase('Live Events').select({
        returnFieldsByFieldId: true,
        fields: ["fldHfuW45YILgxoeQ", "fldyOEXG4rV67tOeU", "fldWqEMJjFquNJIig", "fldGq5Q019PBDMwxs"],
        filterByFormula: `FIND('${id}', {Live Program (CREPO):})`
        //maybe add field restriction to reduce parsed data
    }).all().then(res => {console.log(res.length); return res[0]})

    let atlink = ("https://airtable.com/appTDzZIAs6Mp5rKR/tblcBcHOX50iZfF2J/viw9bV2demqrVFAg4/"+record.get('fldGq5Q019PBDMwxs')+ "?blocks=hide ")   //Airtable link to record
    result = {"id": record.get('fldHfuW45YILgxoeQ').trim(), "start": record.get('fldyOEXG4rV67tOeU')||"no Value", "end": record.get('fldWqEMJjFquNJIig')||"no Value", "atlink": atlink}

    return result
}

async function getStvRecords(date) {
    let now = new Date(date)
    let [formattedDate] = date.toISOString().split('T')
    let [yesterday] = new Date(now.setDate(now.getDate() - 1)).toISOString().split('T')
    //console.log("STV Dates: ", now, yesterday, formattedDate)

    let result = [];
    let records = await StvBase('Streams').select({
        returnFieldsByFieldId: true,
        filterByFormula: "AND(NOT({(CR) AA-ID} = ''), NOT({(CR) Start Event local time (24h)} = ''), IS_AFTER({(CR) Start Event local time (24h)}, DATETIME_PARSE( \"" + yesterday + "\", \"YYYY-MM-DD\")))"
        //maybe add field restriction to reduce parsed data
    }).all()

    //add getting start/end time as value -> result.push({"id": record.get('fldLe62fH8jixHnDY')), "start": record.get(?), "end": record.get(?)})
    records.forEach(function (record) {
        let recordDate = record.get('fld0u3iJmSxKXo8BI')
        let [compareDate] = recordDate.split('T')
        //console.log("Compare Date: " + compareDate)
        if (compareDate === formattedDate) {
            //console.log('Retrieved (STV)', record.get('fldLe62fH8jixHnDY'))
            let atlink = record.get('fld0BvKidQNUw8wdR').url
            result.push({"id": record.get('fldLe62fH8jixHnDY').trim(), "start": record.get('fld0u3iJmSxKXo8BI'), "end": record.get('fldRpqqfO2pNvfPbs'), "atlink": atlink})
        }
    });

    return result;
}

async function getRbtvRecords(date) {
    let now = new Date(date)
    let [formattedDate] = date.toISOString().split('T')
    let [yesterday] = new Date(now.setDate(now.getDate() - 1)).toISOString().split('T')
    //console.log("RBTV Dates: ", now, yesterday, formattedDate)

    let result = [];
    let records = await RbtvBase('Live Events').select({
        returnFieldsByFieldId: true,
        filterByFormula: "AND(NOT({Live Program (CREPO):} = ''), NOT({Start (UTC) (12h):} = ''), IS_AFTER({Start (UTC) (12h):}, DATETIME_PARSE( \"" + yesterday + "\", \"YYYY-MM-DD\")))"
        //maybe add field restriction to reduce parsed data
    }).all()

    //maybe sort in airtable, instead of here?
    let sortedRecords = records.sort(function(a,b){
        return (a.get('fldkXpnvqRHAyCQ3k') < b.get('fldkXpnvqRHAyCQ3k')) ? -1 : ((a.get('fldkXpnvqRHAyCQ3k') > b.get('fldkXpnvqRHAyCQ3k')) ? 1 : 0)
    });

    //add getting start/end time as value -> result.push({"id": record.get('fldHfuW45YILgxoeQ')), "start": record.get(?), "end": record.get(?)})
    sortedRecords.forEach(function (record) {
        //console.log(record.get('Start (UTC) (12h):'))
        let recordDate = record.get('fldkXpnvqRHAyCQ3k')
        let [compareDate] = recordDate.split('T')
        //console.log("Compare Date: " + compareDate)
        if (compareDate === formattedDate) {
            //console.log('Retrieved (RBTV)', record.get('fldHfuW45YILgxoeQ'))
            let atlink = ("https://airtable.com/appTDzZIAs6Mp5rKR/tblcBcHOX50iZfF2J/viw9bV2demqrVFAg4/"+record.get('fldGq5Q019PBDMwxs')+ "?blocks=hide ")   //Airtable link to record
            result.push({"id": record.get('fldHfuW45YILgxoeQ').trim(), "start": record.get('fldyOEXG4rV67tOeU'), "end": record.get('fldWqEMJjFquNJIig'), "atlink": atlink})
        }
    });

    return result;

}

module.exports = {getAirtableData, checkEaseLive}