const express = require('express');
//const http = require('http');
const app = express();
const port = process.env.PORT || 8080;
const favicon = require('serve-favicon')
const path = require("path");
const checkphase = require('./functions/checkphase')
const {getAirtableData} = require("./functions/getAirtableData");

//let httpServer = http.createServer(app)

app.set('views', './views');
app.set('view engine', 'pug');
app.set('query parser', 'simple');
app.use(favicon(__dirname + '/public/favicon/icons8-genie-16.png'))

app.use("/public", express.static(path.join(__dirname, 'public')))

app.use((req, res, next) => {
    console.log(`URL: ${req.url}`);
    next();
});

app.get('/', async (req, res) => {

    let now = new Date()
    let [todayUrl] = now.toISOString().split('T')
    if(!req.query.date)
        res.redirect(req.originalUrl + '?date=' + todayUrl)
    else {
        let query = req.query.date.split('-')
        let year = parseInt(query[0])
        let month = parseInt(query[1])
        let day = parseInt(query[2])
        console.log(year, month, day)
        let date = new Date(year, month - 1, day)
        let phaseData=[], idArrays=[];
        //idArrays needs to be queried differently because structure would be different [[id1, id2, id3,...][...]] -> [{id: id1,...},{id: id2,...},{id: id3, ...},...]
        await getAirtableData(date).then(res=>{idArrays = res})
        await getphaseData(idArrays[0]).then(res => {phaseData[0]=res}) //maybe arrays.id ?
        await getphaseData(idArrays[1]).then(res => {phaseData[1]=res})

        phaseData[0].sort(function(a, b) {
            return (a.start.airtable < b.start.airtable) ? -1 : ((a.start.airtable > b.start.airtable) ? 1 : 0);
        });

        phaseData[1].sort(function(a, b) {
            return (a.start.airtable < b.start.airtable) ? -1 : ((a.start.airtable > b.start.airtable) ? 1 : 0);
        });
        //console.log("pahse data:" + phaseData)
        //console.log(req.query.id)
        //add new time check data to res.render data
        res.render('phasecheckDashboard', {date: req.query.date.split('T')[0], id: req.query.id, phaseDataStv: phaseData[1], phaseDataRbtv: phaseData[0]})
        console.log("phasecheck complete");
    }
});

app.get('/phasecheck', async (req, res) => {
    //need to get airtable start end
    let idArrays = [];
    console.log(req.query.id)
    if (Array.isArray(req.query.id)){
        for (const id of req.query.id) {
            idArrays.push(await getAirtableData(id))
        }
    }else idArrays.push(await getAirtableData(req.query.id))
    let phaseData;
    await getphaseData(idArrays).then(res => {phaseData =res})
    //console.log("pahse data:" + phaseData)
    //console.log(req.query.id)
    //add new time check data to res.render data
    res.render('phasecheck', {id: req.query.id, phaseData: phaseData})
    console.log("phasecheck complete");
});

app.listen(port, () => {
    console.log("Moritz")
    console.log(`Server started at port ${port}`)
});


//input [{id: ..., dmsstart: ...}{}{}]
async function getphaseData(idArray) {
    let phaseData = []
    if (idArray) {
        if (Array.isArray(idArray)) {
            for (const id of idArray) {
                console.log("Checking: " + id.id)
                phaseData.push(await checkphase.checkphase(id.id, id.start, id.end, id.atlink));
            }
        } else
            phaseData.push(await checkphase.checkphase(idArray.id, idArray.start, idArray.end, idArray.atlink))      //Error

    }
    return phaseData;
}

