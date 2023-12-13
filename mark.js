const fs = require("fs")
function cleanFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9-_]/g, "");
}

;(async () => {
  const data = await fs.promises.readFile("./mark/tracks.json", "utf8")
  const tracks = JSON.parse(data)
  let counter = 0
  for await (const track of tracks) {
    const isD = await isDownloaded(track)
    if(isD) {
      counter++
      await markAsDownloaded(track)
    }
  }
  console.log(counter)
})()
const isDownloaded = async (track) => {
  const parts = track.url.split("/")
  const lastPart = parts[parts.length - 1].trim()
  const data = await fs.promises.readFile("./mark/downloaded.txt", "utf8")
  const rows = data.split("\n")
  return rows.some(fileName => {
    const beforeTilda = fileName.split("~")[0].trim()
    return cleanFileName(beforeTilda) === cleanFileName(lastPart)
  })
}


async function markAsDownloaded(track) {
  try {
    const data = await fs.promises.readFile("./mark/tracks.json", "utf8")
    let tracks = JSON.parse(data)
    const index = tracks.findIndex((item) => item.url === track.url)
    if (index !== -1) {
      tracks[index].downloaded = true
    }
    await fs.promises.writeFile("./mark/tracks.json", JSON.stringify(tracks, null, 2))
    console.log("Total downloads:", index + 1)
  } catch (err) {
    console.error("Error:", err)
  }
}