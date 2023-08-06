import { getPublicKey, nip19 } from "nostr-tools";
import fs from "fs";
import path from "path";
import { NDKPrivateKeySigner, NDKEvent } from "@nostr-dev-kit/ndk";
import NDK from "@nostr-dev-kit/ndk";

interface Keys {
    npub: string;
    nsec: string;
}
interface Note {
    text: string;
    title: string;
    subtitle: string;
    fieldsOfStudy: string[];
}

const loadJSON = (filename: string): Note => {
    const rawdata: string = fs.readFileSync(path.join(filename), 'utf8')
    return JSON.parse(rawdata);
}
const loadNPUB = (filename: string): Keys => {
    // console.log(`Loading ${filename}`);
    const rawdata: string = fs.readFileSync(path.join(filename), 'utf8');
    return JSON.parse(rawdata);
}

const createNote = async (note: Note, pubKey: string, ndk: NDK, signer: NDKPrivateKeySigner): Promise<NDKEvent> => {
    let ndkEvent: NDKEvent = new NDKEvent(ndk);
    await ndk.connect().then(() => {
        ndkEvent.kind = 30041;
        ndkEvent.content = note.text
        ndkEvent.pubkey = getPublicKey(pubKey);
        ndkEvent.tags = [
            ['title', note.title],
        ];
    }).catch((err: any) => { console.log(err) })
    await ndkEvent.sign(signer);
    await ndk.publish(ndkEvent);
    return ndkEvent;
}

const createArticleHeader = async (note: Note, filename: string, pubKey: string, eventList: NDKEvent[], ndk: NDK, signer: NDKPrivateKeySigner): Promise<NDKEvent> => {
    let ndkEvent: NDKEvent = new NDKEvent(ndk);
    const corpusID: string = filename.split('_')[0];
    await ndk.connect().then(() => {
        ndkEvent.kind = 30040;
        ndkEvent.content = `{"corpusId": "${corpusID}", "title": "${note.title}","fieldsOfStudy": ${note.fieldsOfStudy}}`;
        ndkEvent.pubkey = getPublicKey(pubKey);
        ndkEvent.tags = [];
        for (let i = 0; i < eventList.length; i++) {
            ndkEvent.tags.push(['e', eventList[i].id, 'wss://relay.damus.io'])
        }
    }).catch((err: any) => { console.log(err) })
    await ndkEvent.sign(signer);
    await ndk.publish(ndkEvent);
    return ndkEvent;
}
const main = async (): Promise<void> => {
    const jsonFolder: string[] = fs.readdirSync('./jsonFiles');
    const jsonFiles: string[] = jsonFolder.filter((file: string) => file.endsWith('.json'));
    console.log(`Found ${jsonFiles.length} files`);

    // user.json looks like this: {"npub": <npub>, "nsec": <nsec>}
    const userKeys: Keys = loadNPUB('./user.json');
    const nsec: string = userKeys.nsec;
    const privateKey: nip19.DecodeResult = nip19.decode(nsec) as { type: 'nsec', data: string };
    const pubKey: string = privateKey.data;
    const signer: NDKPrivateKeySigner = new NDKPrivateKeySigner(privateKey.data);
    const ndk: NDK = new NDK({
        explicitRelayUrls: ['wss://relay.damus.io'],
        signer: signer
    })
    let eventList: NDKEvent[] = [];
    // 993410 relates fo the corpusID that the article is associated with, it creates a list of all the files that have that corpusID and sorts them by according to the start_token index
    // this is to create an ordered list of events for the article, you may need additional criteria to sort the files that you'd like to upload
    const forward_files: string[] = jsonFiles.filter((file: string) => file.includes('10925610')).sort((a: string, b: string) => Number(a.split('.')[0]) - Number(b.split('.')[0]));

    for (let i = 0; i < forward_files.length; i++) {
        console.log(`Processing ${forward_files[i]}`);
        const text: Note = loadJSON(`./jsonFiles/${forward_files[i]}`);
        // JSON looks like this:
        // filename is <corpusID>_{start_token}_{end_token}.json
        // corpusID is attained from semantic scholar (see )
        // {"text": <text>, "title": <title>,
        // "subtitle": <subtitle>, "fieldsOfStudy": [<field1>, <field2>, ...]}
        const event: Promise<NDKEvent> = createNote(text, pubKey, ndk, signer);
        eventList.push(await event);
        console.log(`List is now ${eventList.length} long`);
    }
    const header: Promise<NDKEvent> = createArticleHeader(loadJSON(`./jsonFiles/${forward_files[0]}`), forward_files[0], pubKey, eventList, ndk, signer);
    await header;
    // }
    // ndk.removeAllListeners();
    // await header;
}
main();
