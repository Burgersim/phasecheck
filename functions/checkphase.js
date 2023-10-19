const axios = require('axios')
const http = require("http");
const https = require("https");
const {checkEaseLive} = require("./getAirtableData");

async function checkphase(liveprogramid, atstart, atend, atlink) {

    let makeTvApiLink = function (id) {
        return `https://api.redbull.tv/v3/products/` + id + '?omitGeoblock=true'
    }
    let makeDmsLink = function (id) {
        return `https://dms.redbull.tv/live/v1.1/` + id + '?omitGeoblock=true'
    }
    let makeLotDmsLink = function(id) {
        return 'https://dms.redbull.tv/dms/admin/destinations/' + id + '?omitGeoblock=true'
    }
    //console.log("checkphase: " +liveprogramid +atstart +atend)

    let authToken = process.env.TVAPI_RBTV_AUTH_TOKEN
    let eventStopId = ''
    let user = process.env.LOT_DMS_USER
    let pass = process.env.LOT_DMS_PASSWORD

    if (liveprogramid.startsWith("AA")) {
        authToken = process.env.TVAPI_STV_AUTH_TOKEN
        makeTvApiLink = function (id) {
            return 'https://api.redbull.tv/v3/products/' + id + '?namespace=stv&omitGeoblock=true'
        }
        makeDmsLink = function (id) {
            return 'https://dms.redbull.tv/live/v1.1/' + id + '?namespace=stv&omitGeoblock=true'
        }
        makeLotDmsLink = function (id) {
            return 'https://dms.redbull.tv/dms/admin/destinations/' + id + '?namespace=stv&omitGeoblock=true'
        }
    }

    let data = {
        "eventStopTitle": "",
        "liveProgramTitle": "",
        "liveProgramTvApiPhase": "",
        "liveProgramDmsPhase": "",
        "liveProgramComPhase": "",
        "eventStopTvApiPhase": "",
        "eventStopDmsPhase": "",
        "eventStopComPhase": "",
        "crepolink": "https://explore.redbull.com/explore?query=%2Fv3%2Fcontent%2Frrn%3Acontent%3Alive-videos%3A"+ liveprogramid.split(":")[3],
        "id": liveprogramid,
        "atlink": atlink,
        "eventStopId": eventStopId,
        "lotlink" : "",
        "start": {"airtable": atstart, "tvapi": "", "dms": "", "crepo": ""},     // start: {"tvapi": "", "airtable": "", "dms": "", "lotDms": ""} + crepo -lotdms --done
        "end": {"airtable": atend, "tvapi": "", "dms": "", "crepo": ""}, // end: same... --done
        "syncedwithat": {"tvapi": false, "dms": false, "crepo": false},  //if in sync with Airtable start & end
        "primaryStream": "",
        "isDefault": {tvApi: false, dms: false},
        "embedsTvApi": {},
        "embedsDms": {},
        "overrides": [],
        "cuetag": "",
        "cbHidden": "",
        "easeLive": await checkEaseLive(liveprogramid),
        "error": ""
    };

    //console.log("Auth Token: " + authToken)

    var config = {
        method: 'get',
        url: makeTvApiLink(liveprogramid),
        headers: {
            'Authorization': authToken
        }
    };

    //TvApi Request LiveProgramId to get EventStopId
    data = await axios(config)
        .catch(err => {if(err)
            console.log(err.message)
            data.error = err.message
            return data;
        })
        .then(function (response) {
            //console.log("Response:" + response)
            if(!response.error) {
                if(response.data.links.length !== 0)
                    eventStopId = response.data.links[0].id
                else if(response.data.deeplink_playlist !== ""){
                    eventStopId = response.data.deeplink_playlist.split(":")[0]
                }
                else {
                    eventStopId = "noID"
                }
                data.eventStopId = eventStopId
            }
            else
                return response;
            //console.log(eventStopId)
        }).then(async function () {
        try {
            //Requests for Data
            //TvApI LivePrgram -> data.start.tvapi / data.end.tvapi --done
            await axios.get(makeTvApiLink(liveprogramid), {
                headers: {'Authorization': authToken},
                httpAgent: new http.Agent({keepAlive: true}),
                httpsAgent: new https.Agent({keepAlive: true})
            }).then(async (res) => {
                //console.log("Live Program TVAPI Data: " + JSON.stringify(res.data, null, 4))
                //console.log("Tv Api Data: " + JSON.stringify(res.data, null, 4))
                //console.log("checking Tv Api with liveprogramid")
                data.liveProgramTvApiPhase = res.data.status.code
                data.liveProgramTitle = res.data.title
                data.start.tvapi = res.data.status.start_time
                data.end.tvapi = res.data.status.end_time
                data.syncedwithat.tvapi = (data.start.tvapi === data.start.airtable)&&(data.end.tvapi === data.end.airtable)
                data.embedsTvApi.right = res.data.embed_right
                data.embedsTvApi.bottom = res.data.embed_bottom
                data.overrides = res.data.overrides
                data.cbHidden = res.data.hide_corner_bug

            })
            await axios.get(makeTvApiLink(eventStopId), {
                headers: {'Authorization': authToken},
                httpAgent: new http.Agent({keepAlive: true}),
                httpsAgent: new https.Agent({keepAlive: true})
            }).then((res) => {
                //console.log("checking Tv Api with eventstopid")
                data.eventStopTvApiPhase = res.data.status.code
                data.eventStopTitle = res.data.title
                data.isDefault.tvApi = res.data.status.play === liveprogramid
            })
            //DMS Live Program -> dta.start.dms / data.end.dms --done
            await axios.get(makeDmsLink(liveprogramid)).then(async (res) => {
                //console.log("checking DMS with liveprogramid")
                //console.log("Dms Data: " + JSON.stringify(res.data, null, 4))
                data.liveProgramDmsPhase = res.data.status.code
                data.embedsDms.right = res.data.status.embed_right
                data.embedsDms.bottom = res.data.status.embed_bottom
                data.start.dms = res.data.status.start_time
                data.end.dms = res.data.status.end_time
                data.syncedwithat.dms = (data.start.dms === data.start.airtable)&&(data.end.dms === data.end.airtable)
                data.cuetag = res.data.cue_tag.active

            })
            await axios.get(makeDmsLink(eventStopId)).then((res) => {
                //console.log("checking DMS with eventstopid")
                //console.log("Dms Eventstop Data: " + JSON.stringify(res.data, null, 4))
                data.eventStopDmsPhase = res.data.status.code
                data.isDefault.dms = res.data.status.play === liveprogramid
            })
            //console.log("LOT DMS URL: " + makeLotDmsLink(liveprogramid))



            if(liveprogramid.startsWith('rrn:')){
                // FETCH ASSETS FROM CREPO VIA CONTENT DELIVERY API

                const productionEndpoint = 'https://api.redbull.com';

                const crepoHeaders = {
                    "apiKey": process.env.CREPO_API_KEY
                }


                const crepoQueryLiveProgram = {
                    query: `query getLiveProgramPhase($liveProgramId: String!)
                    {
                        resource(id: $liveProgramId) {
                            ... on LiveVideo {
                                id
                                status
                                statusLabel
                                statusMessage
                                startDate {
                                    dateTimeUTC
                                }
                                endDate {
                                    dateTimeUTC
                                }
                            }
                        }
                    }`,
                    variables: {
                        "liveProgramId": liveprogramid
                    }
                }

                const crepoQueryEventStop = {
                    query: `query geteventStopPhase($eventStopId: String!)
                            {
                                resource(id: $eventStopId) {
                                    ... on EventProfile {
                                        id
                                        liveStatus
                                        startDate {
                                            dateTimeUTC
                                        }
                                        endDate {
                                            dateTimeUTC
                                        }
                                            livePrimary {
                                                id
                                                status
                                            }
                                        }
                                    }
                                }`,
                    variables: {
                        "eventStopId": eventStopId
                    }
                }

                const graphQLClient = axios.create({
                    baseURL: productionEndpoint,
                    timeout: 5000,
                    headers: crepoHeaders,
                })

                //Maybe also check thist for time for RB Assets? -> data.start.crepo / data.end.crepo --done
                await graphQLClient.post('/v1/graphql', crepoQueryLiveProgram).then(res => {
                    //console.log("graphQL Live Program Response: " + JSON.stringify(res.data, null, 3))
                    data.liveProgramComPhase = res.data.data.resource.status
                    data.start.crepo = res.data.data.resource.startDate.dateTimeUTC
                    data.end.crepo = res.data.data.resource.endDate.dateTimeUTC
                    data.syncedwithat.crepo = (data.start.crepo === data.start.airtable)&&(data.end.crepo === data.end.airtable)
                    //console.log("Crepo start:" + data.start.crepo)

                })

                await graphQLClient.post('/v1/graphql', crepoQueryEventStop).then(res => {
                    //console.log("graphQL Event Stop Response: " + JSON.stringify(res.data, null, 3))
                    data.eventStopComPhase = res.data.data.resource.liveStatus
                })
            }

            //LotDms Live Program -> data.start.lotdms / data.end.lotdms -- no times delivered
            await axios.get(makeLotDmsLink(liveprogramid), {
                auth: {
                    username: user,
                    password: pass
                }
            }).then(res => {
                //console.log(res)
                if(res.data.stream_targets.length === 0){
                    data.primaryStream = res.data.options.primary
                    //console.log("Default Stream: " + data.defaultStream)
                } else {
                    data.primaryStream = res.data.stream_targets.find(stream_targets => stream_targets.is_default === true).url
                    //console.log("Default Stream: " + data.defaultStream)
                }
            })


        } catch (error) {
            if(error.request){
                console.error('Error (Request): ', error.request);
            } else if (error.response) {
                console.error('Error (Response): ', error.response.data);
                console.error('Error (Response Status): ', error.response.status);
                console.error('Error (Response Headers): ', error.response.headers);
            } else {
                console.error('Error (Message): ', error.message);
            }
            //console.error("Error during Checkphase-Function: " + error.name + ": " + error.message)
            //console.error("Error during Checkphase-Function: " + error.request)
            //console.error(error)
        }
    }).then(function() {
        //console.log("Data: " + JSON.stringify(data, null, 4))
        //console.log('checkphase function ended')
        return data;
    }).catch(function (error) {
            console.log(error);
        })


    data.lotlink = data.id.startsWith("AA")?"https://liveops.redbull.com/stv/live-events/"+data.eventStopId+"/streams/"+data.id : "https://liveops.redbull.com/rbtv/live-events/"+data.eventStopId+"/streams/"+data.id

    return data;

}

module.exports = {
    checkphase
}