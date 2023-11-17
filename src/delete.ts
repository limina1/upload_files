import { getPublicKey, nip19 } from "nostr-tools";
import fs from "fs";
import path from "path";
import { NDKPrivateKeySigner, NDKEvent } from "@nostr-dev-kit/ndk";
import NDK from "@nostr-dev-kit/ndk";
// import Bottleneck from "bottleneck";
// import 'websocket-polyfill';
// import { relayInit, getEventHash, getSignature } from "nostr-tools";

const createDeleteEvent = async (eventIDs: string[], pubKey: string, ndk: NDK, signer: NDKPrivateKeySigner) => {
    let ndkEvent: NDKEvent = new NDKEvent();
    await ndk.connect().then(() => {
        ndkEvent.kind = 5;
        ndkEvent.pubkey = getPublicKey(signer.privateKey);
        console.log(ndkEvent.tags);
        for (let i = 0; i < eventIDs.length; i++) {
            ndkEvent.tags.push(['e', eventIDs[i]]);
        }

    }).catch((err: any) => {
        console.log(err);
    });
    console.log(`Deleting ${eventIDs.length} events`);
    await ndkEvent.sign(signer);
    await ndk.publish(ndkEvent);
    console.log("Event published");
}
interface Keys {
    npub: string;
    nsec: string;
}

const loadNPUB = (filename: string): Keys => {
    const rawdata: string = fs.readFileSync(path.join(filename), "utf8");
    return JSON.parse(rawdata);
}
const user: Keys = loadNPUB("./user.json");

const private_key: nip19.DecodeResult = nip19.decode(user.nsec) as { type: 'nsec', data: string }
// const public_key: string = private_key.data;
const public_key: string = getPublicKey(private_key.data);

const signer: NDKPrivateKeySigner = new NDKPrivateKeySigner(private_key.data);

const ndk: NDK = new NDK({ explicitRelayUrls: ['wss://nostr.thesamecat.io'], signer: signer });
const kinds: number[] = [30040, 30041];
// const user_account: NDKUser = ndk.getUser({ npub: user.npub });
ndk.connect().then(() => { console.log("Connected to Nostr") }).catch((err: any) => { console.log(err) });
// ndk.fetchEvents({ authors: [user.npub] }).then((events: NDKEvent[]) => { console.log(events.length) }).catch((err: any) => { console.log(err) });
console.log(`Fetching events for ${user.npub}`);
ndk.fetchEvents({ kinds, authors: [public_key] }).then((events: NDKEvent[]) => {
    let eventIDs: string[] = [];
    events.forEach((event: NDKEvent) => {
        eventIDs.push(event.id);
    })
    createDeleteEvent(eventIDs, public_key, ndk, signer);
});





// find all events of kind 30040
