const fs = require("fs")
const readline = require("readline")

const dotenv = require("dotenv")
dotenv.config()

const { default: Soundcloud } = require("soundcloud.ts")
const puppeteer = require("puppeteer")

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const scrapeInfiniteScrollTracks = async (page, itemTargetCount) => {
  let tracks = []
  let isEnd = false
  while (itemTargetCount > tracks.length && !isEnd) {
    tracks = await page.evaluate(() => {
      const base = "https://soundcloud.com"
      const items = Array.from(
        document.querySelectorAll(".sound__body .soundTitle .soundTitle__title")
      )
      return items.map((item) => {
        const url = base + item.getAttribute("href")
        const downloaded = false
        return { url, downloaded }
      })
    })
    isEnd = await page.evaluate(() => {
      const eof = document.querySelector(".paging-eof.sc-border-light-top")
      if (eof) return true
    })
    if (!isEnd) {
      previousHeight = await page.evaluate("document.body.scrollHeight")
      await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
      await page.waitForFunction(
        `document.body.scrollHeight > ${previousHeight}`
      )
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  return tracks.slice(0, itemTargetCount)
}

;(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--disable-features=site-per-process']
  })

  const page = await browser.newPage()
  await createTracksDirectory()
  const leftTracks = await isTrackJSON()
  if (leftTracks) {
    await downloadSound(leftTracks)
  } else {
    rl.question("Soundcloud user url:", async (url) => {
      await page.goto(url)
      rl.question("count: ", async (count) => {
        const data = await scrapeInfiniteScrollTracks(page, count)
        rl.close()
        const tracks = data.filter((item) => {
          return !item.url.includes("set")
        })
        const setTracks = new Set(tracks)
        const uniqueTracks = Array.from(setTracks)
        await fs.promises.writeFile(
          "tracks.json",
          JSON.stringify(uniqueTracks),
          (err) => {
            if (err) console.log("err=> ", err)
          }
        )
        fs.readFile("tracks.json", "utf8", (err, data) => {
          let tracks = JSON.parse(data)
          downloadSound(tracks)
        })
        await browser.close()
      })
    })
  }
})()

async function downloadSound(data) {
  const soundcloud = new Soundcloud({
    clientId: process.env.CLIENT_ID,
    oauthToken: process.env.ACCESS_TOKEN,
  })
  for await (const track of data) {
    const isD = await isDownloaded(track)
    if (!isD) {
      await soundcloud.util.downloadTrack(track.url, "./tracks")
      await markAsDownloaded(track)
    } else {
      console.log("Already downloaded before: ", track)
    }
  }
  await fs.promises.unlink("./tracks.json")
}

async function markAsDownloaded(track) {
  try {
    const data = await fs.promises.readFile("tracks.json", "utf8")
    let tracks = JSON.parse(data)
    const index = tracks.findIndex((item) => item.url === track.url)
    if (index !== -1) {
      tracks[index].downloaded = true
    }
    await fs.promises.writeFile("tracks.json", JSON.stringify(tracks, null, 2))
    console.log("Total downloads:", index + 1)
  } catch (err) {
    console.error("Error:", err)
  }
}

async function isDownloaded(track) {
  const parts = track.url.split("/")
  const lastPart = parts[parts.length - 1]
  const data = await fs.promises.readdir("./tracks")
  return data.some((fileName) => {
    const beforeTilda = fileName.split("~")[0]
    return beforeTilda === lastPart || track.downloaded
  })
}
//https://soundcloud.com/user-376614630
async function createTracksDirectory() {
  try {
    await fs.promises.mkdir("./tracks")
  } catch (err) {}
}

async function isTrackJSON() {
  try {
    let data = await fs.promises.readFile("tracks.json", "utf8")
    let tracks = JSON.parse(data)
    const nonDownloads = tracks.filter((item) => !item.downloaded)
    console.log('nonDownloads', nonDownloads)
    console.log("Skipped: ", tracks.length - nonDownloads.length)
    return nonDownloads
  } catch (err) {
    return false
  }
}