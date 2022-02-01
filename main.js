const axios = require("axios")
const express = require("express")
const api_url = "https://api.twitter.com/2/tweets/search/recent?query="
const j2e = require("json2emap")

const app = express()


const token = process.env.TWITTER_TOKEN
if (!token) new Error("twitter bearer token not provided")

var CachedData = {}
var CacheDate = 0
var CacheLife = 5*60*1000



app.get("/tweets/search",async (req, res) => {
    if(!req.query.q) {
        res.status(400).send("BAD_REQUEST")
        return
    }
    try {
        let data
        let nowDate = new Date()

        if(req.query.cache && (nowDate - CacheDate) > CacheLife)
            data = CachedData
        else
            data = await axios.get(api_url + encodeURIComponent(req.query.q), {headers:{Authorization: `Bearer ${token}`}})
        
        CachedData = data
        CacheDate = nowDate

        res.send(req.query.emap ? j2e(data.data) : data.data)
        return
    } catch(e) {
        // console.error(e)
        res.status(500).send("INTERNAL_SERVER_ERROR")
    }
})

const server = app.listen(3000,() => console.log("OK"))