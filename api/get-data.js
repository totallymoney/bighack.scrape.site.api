const puppeteer = require('puppeteer')
const chrome = require('chrome-aws-lambda')

module.exports = async (req, res) => {
    const POSTCODE = req.query.postcode
    const ADDRESS = req.query.address

    if (POSTCODE || ADDRESS) {
        res.status(204).json({
            error: 'Missing postcode or address',
        })
    }

    const getTagContent = async (page, selector, isDiv = false) => {
        const element = await page.$(selector)
        return await (await element.getProperty(isDiv ? 'innerHTML' : 'textContent')).jsonValue()
    }
    const getWebDataV2 = async () => {
        const browser = await puppeteer.launch({
            args: chrome.args,
            executablePath: await chrome.executablePath,
            headless: chrome.headless,
        })
        const page = await browser.newPage()
        await page.goto('http://www.southkesteven.gov.uk/index.aspx?articleid=8930', { waitUntil: 'networkidle2' })

        await page.waitFor('input[name=q]')
        await page.$eval('input[name=q]', el => el.value = POSTCODE)

        await page.click(".subform button, input[type='submit']")

        await page.waitForSelector('.delta select[name=address]')
        const option = (await page.$x(
            `//*[@id = "address"]/option[text() = ${ADDRESS}]`,
        ))[0]
        const value = await (await option.getProperty('value')).jsonValue()
        await page.select('.delta select[name=address]', value)

        await page.click(".delta button[type='submit']")
        await page.waitForSelector('.alert.icon--bin')

        const nextBinDate = await getTagContent(page, '.alert__heading.alpha')
        const nextBinDateColor = await getTagContent(page, 'aside.alert.icon--bin > p:nth-child(2)')

        let secondBinColor
        const secondBinDate = await getTagContent(page, '.bindays article:nth-child(3) .binday__details .binday__cell--day', true)

        const secondBinElement = await page.$('.bindays article:nth-child(3)')
        const secondBinElementClassName = await (await secondBinElement.getProperty('className')).jsonValue()

        if (secondBinElementClassName.search('green') !== -1) {
            secondBinColor = 'green'
        }
        if (secondBinElementClassName.search('silver') !== -1) {
            secondBinColor = 'silver'
        }
        if (secondBinElementClassName.search('black') !== -1) {
            secondBinColor = 'black'
        }


        await browser.close()
        return { nextBinDate, nextBinDateColor, secondBinColor, secondBinDate }
    }

    const { nextBinDate, nextBinDateColor, secondBinDate, secondBinColor } = await getWebDataV2()


    res.json({
        nextBinDateColor,
        nextBinDate,
        secondBinDate,
        secondBinColor,
    })
}
