const cheerio = require('cheerio')
const axios = require('axios')
const CryptoJS = require('crypto-js')

// 測試時忽略證書驗證
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

let appConfig = {
    ver: 1,
    title: '兩個BT',
    site: 'https://www.bttwo.me',
}

async function getConfig() {
    let config = appConfig
    config.tabs = await getTabs()
    return config
}

async function getTabs() {
    let list = []
    let ignore = ['首页', '热门下载', '公告求片']
    function isIgnoreClassName(className) {
        return ignore.some((element) => className.includes(element))
    }

    const { data } = await axios.get(appConfig.site, {
        headers: {
            'User-Agent': UA,
        },
    })
    const $ = cheerio.load(data)

    let allClass = $('ul.navlist a')
    allClass.each((i, e) => {
        const name = $(e).text()
        const href = $(e).attr('href')
        const isIgnore = isIgnoreClassName(name)
        if (isIgnore) return

        list.push({
            name,
            ext: {
                id: i.toString(),
                url: appConfig.site + href,
            },
        })
    })

    return list
}

async function getCards(ext) {
    let cards = []
    let { page = 1, url } = ext

    if (page > 1) {
        url += `/page/${page}`
    }

    // 发送请求
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': UA,
        },
    })

    // 加载 HTML
    const $ = cheerio.load(data)

    // 解析数据，例如提取标题
    $('div.bt_img > ul li').each((_, element) => {
        const href = $(element).find('a').attr('href')
        const title = $(element).find('img.thumb').attr('alt')
        const cover = $(element).find('img.thumb').attr('data-original')
        const subTitle = $(element).find('.jidi span').text()
        const hdinfo = $(element).find('.hdinfo .qb').text()
        cards.push({
            vod_id: href,
            vod_name: title,
            vod_pic: cover,
            vod_remarks: subTitle || hdinfo,
            url: href,
            ext: {
                url: href,
            },
        })
    })

    return {
        list: cards,
    }
}

async function getTracks(ext) {
    let tracks = []
    let url = ext.url

    // 发送请求
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': UA,
        },
    })

    // 加载 HTML
    const $ = cheerio.load(data)

    // 單集名稱重複會導致直接播放緩存的url，暫時加上劇名等修
    let show = $('.moviedteail_tt h1').text()
    $('.paly_list_btn a').each((_, e) => {
        const name = $(e).text()
        const href = $(e).attr('href')
        tracks.push({
            name: `${show}-${name}`,
            pan: '',
            ext: {
                url: href,
            },
        })
    })

    return {
        list: [
            {
                title: '默认分组',
                tracks,
            },
        ],
    }
}

async function getPlayinfo(ext) {
    const url = ext.url

    // 发送请求
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': UA,
        },
    })
    function aesCbcDecode(ciphertext, key, iv) {
        const encryptedHexStr = CryptoJS.enc.Base64.parse(ciphertext)
        const encryptedBase64Str = CryptoJS.enc.Base64.stringify(encryptedHexStr)

        const keyHex = CryptoJS.enc.Utf8.parse(key)
        const ivHex = CryptoJS.enc.Utf8.parse(iv)

        const decrypted = CryptoJS.AES.decrypt(encryptedBase64Str, keyHex, {
            iv: ivHex,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
        })

        const plaintext = decrypted.toString(CryptoJS.enc.Utf8)
        return plaintext
    }

    let isPlayable = data.split('window.wp_nonce=')[1]
    if (isPlayable) {
        let text = isPlayable.split('eval')[0]
        let code = text.match(/var .*?=.*?"(.*?)"/)[1]
        let key = text.match(/var .*?=md5.enc.Utf8.parse\("(.*?)"/)[1]
        let iv = text.match(/var iv=.*?\((\d+)/)[1]

        text = aesCbcDecode(code, key, iv)
        let playurl = text.match(/url: "(.*?)"/)[1]

        return { urls: [playurl] }
    }
}

async function search(ext) {
    let cards = []

    let text = ext.text // 搜索文本
    let page = ext.page || 1
    let url = `${appConfig.site}/xssssearch?q=${text}$f=_all&p=${page}`

    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': UA,
        },
    })

    const $ = cheerio.load(data)

    $('div.bt_img > ul li').each((_, element) => {
        const href = $(element).find('a').attr('href')
        const title = $(element).find('img.thumb').attr('alt')
        const cover = $(element).find('img.thumb').attr('data-original')
        const subTitle = $(element).find('.jidi span').text()
        const hdinfo = $(element).find('.hdinfo .qb').text()
        cards.push({
            vod_id: href,
            vod_name: title,
            vod_pic: cover,
            vod_remarks: subTitle || hdinfo,
            url: href,
            ext: {
                url: href,
            },
        })
    })

    return {
        list: cards,
    }
}

module.exports = { getConfig, getCards, getTracks, getPlayinfo, search }