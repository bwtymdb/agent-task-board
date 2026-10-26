const http = require('node:http')
const fs = require('node:fs')

let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', chunk => { input += chunk })
process.stdin.on('end', () => {
  try {
    const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
    const request = http.request({
      hostname: '127.0.0.1', port: config.port, path: '/hook', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` }
    })
    request.on('error', () => process.exit(1))
    request.end(input)
  } catch {
    process.exit(1)
  }
})
