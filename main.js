const axios = require("axios")
const express = require("express")
const { set } = require("express/lib/application")
const api_url = "https://api.twitter.com/2/"
const j2e = require("json2emap")

const app = express()


const token = process.env.TWITTER_TOKEN
if (!token) throw Error("twitter bearer token not provided")

var CachedData = {}
var CacheDate = 0
var CacheLife = 5*60*1000

async function Search(query, count=10){
    let url = `${api_url}tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${count}&expansions=author_id,referenced_tweets.id&tweet.fields=created_at`
    let tweets = (await axios.get(url, {headers:{Authorization: `Bearer ${token}`}})).data.data

    let reftweetIDs = []
    let userIDs = []

    for(value of tweets){
        if(value.referenced_tweets != undefined)
            reftweetIDs.push(value.referenced_tweets[0].id)

        userIDs.push(value.author_id)
    }

    reftweetIDs = Array.from(new Set(reftweetIDs))
    let refTweets = await TweetsLookup(reftweetIDs.join(","))
    let refTweetsKey = {}
    for(key in refTweets){
        refTweetsKey[refTweets[key].id] = key
    }
    
    for(value of refTweets){
        userIDs.push(value.author_id)
    }
    
    userIDs = Array.from(new Set(userIDs))
    let users = await UsersLookup(userIDs.join(","))
    let usersKey = {}
    for(key in users){
        usersKey[users[key].id] = key
    }

    let res = []
    for(value of tweets){
        let tmp = {
            "user_id": users[usersKey[value.author_id]].username,
            "user_name": users[usersKey[value.author_id]].name,
            "thumbnail": users[usersKey[value.author_id]].profile_image_url,
            "created_at": value.created_at,
            "text": value.text
        }
        if(value.referenced_tweets == undefined)
            tmp.type = "Tweeted"
        else{
            tmp.type = value.referenced_tweets[0].type
            let tweet = refTweets[refTweetsKey[value.referenced_tweets[0].id]]
            if(tmp.type == "retweeted"){
                tmp.text = tweet.text
                tmp.retweeted_by = {
                    "user_id": tmp.user_id,
                    "user_name": tmp.user_name,
                    "thumbnail": tmp.thumbnail
                }
                tmp.user_id = users[usersKey[tweet.author_id]].username
                tmp.user_name = users[usersKey[tweet.author_id]].name
                tmp.thumbnail = users[usersKey[tweet.author_id]].profile_image_url
            }
            else if(tmp.type == "quoted"){
                tmp.referenced_tweet = {
                    "user_id": users[usersKey[tweet.author_id]].username,
                    "user_name": users[usersKey[tweet.author_id]].name,
                    "thumbnail": users[usersKey[tweet.author_id]].profile_image_url,
                    "created_at": tweet.created_at,
                    "text": tweet.text
                }
            }
        }
        res.push(tmp);
    }
    return res
}
async function TweetsLookup(ids){
    let url = `${api_url}tweets?ids=${encodeURIComponent(ids)}&expansions=author_id&tweet.fields=created_at`
    let users = (await axios.get(url, {headers:{Authorization: `Bearer ${token}`}})).data.data
    return users
}
async function UsersLookup(ids){
    let url = `${api_url}users?ids=${encodeURIComponent(ids)}&user.fields=profile_image_url`
    let users = (await axios.get(url, {headers:{Authorization: `Bearer ${token}`}})).data.data
    return users
}

app.get("/tweets/search",async (req, res) => {
    if(!req.query.q) {
        res.status(400).send("BAD_REQUEST")
        return
    }
    try {
        let data
        let nowDate = new Date()

        if(req.query.cache && (nowDate - CacheDate) < CacheLife)
            data = CachedData
        else{
            data = await Search(req.query.q, req.query.count)
            CachedData = data
            CacheDate = nowDate
        }
        res.send(req.query.emap ? j2e(data) : data)
        return
    } catch(e) {
        console.error(e)
        res.status(500).send("INTERNAL_SERVER_ERROR")
    }
})

const server = app.listen(3000,() => console.log("OK"))