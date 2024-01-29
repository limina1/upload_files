import { getPublicKey, nip19 } from "nostr-tools";
import 'websocket-polyfill';
import {
    relayInit,
    generatePrivateKey,
    getEventHash,
    getSignature
} from 'nostr-tools'
import fs from "fs";
import path from "path";
import { NDKPrivateKeySigner, NDKEvent } from "@nostr-dev-kit/ndk";
import NDK from "@nostr-dev-kit/ndk";
const loadNPUB = (filename) => {
    const rawdata = fs.readFileSync(path.join(filename), "utf8");
    return JSON.parse(rawdata);
}
const keys = loadNPUB("../user.json");
const nsec = keys.nsec;
const privateKey = nip19.decode(nsec);
const pubKey = getPublicKey(privateKey.data);

const relay = relayInit("wss://nostr.thesamecat.io")
relay.on('connect', () => {
    console.log(`connected to ${relay.url}`)
})
relay.on('error', () => {
    console.log(`failed to connect to ${relay.url}`)
})
await relay.connect()
// let sub = relay.sub([
//     {
//         authors: [pubKey],
//     }
// ])
// sub.on('event', event => {
//     console.log('we got an event!', event)
// })
// console.log('eose', () => {
//     sub.unsub()
// })

// let events = await relay.list([{ kinds: [30040] }])
const kind = 30040;
let events = await relay.list([{ kinds: [kind] }])
console.log(`found ${events.length} events of kind ${kind}`)
for (let event of events) {
    console.log(event.content)
}


relay.close()
