import { getPublicKey, nip19 } from "nostr-tools";
import fs from "fs";
import path from "path";
import { NDKPrivateKeySigner, NDKEvent } from "@nostr-dev-kit/ndk";
import NDK from "@nostr-dev-kit/ndk";
import Bottleneck from "bottleneck";
const limiter = new Bottleneck({
    minTime: 2500
});


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

const relayUrls: string[] = ['wss://nostr.thesamecat.io/'];
const folder: string = './notes';
const articleName: string = 'Support Vector Machine';
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
    /*
     * Loads note object and creates a NDKEvent
     * @param note: Note object with text, title and metadata entries
     * title entry in the node is the subtitle text of the specific note belonging to the article, not the title of the article
     * Kind 30041 is a note
     */
    let ndkEvent: NDKEvent = new NDKEvent(ndk);
    await ndk.connect().then(() => {
        ndkEvent.kind = 30041;
        console.log(`Creating note with text ${note.text}`);
        ndkEvent.content = note.text
        ndkEvent.pubkey = getPublicKey(pubKey);
        ndkEvent.tags = [
            ['title', note.title],
        ];
    }).catch((err: any) => {
        console.log(err)
    });
    await ndkEvent.sign(signer);
    await ndk.publish(ndkEvent);

    return ndkEvent;
}

const createArticleHeader = async (note: Note, filename: string, pubKey: string, eventList: NDKEvent[], ndk: NDK, signer: NDKPrivateKeySigner, articleTitle: string): Promise<NDKEvent> => {
    /*
     * Loads note object and creates a NDKEvent
     * @param note: Note object with text, title and metadata entries
     * title is the title of the article
     * Kind 30040 is an article header
     * appends all event IDs as a list of notes that compose the article
     */
    let ndkEvent: NDKEvent = new NDKEvent(ndk);
    const corpusID: string = filename.split('_')[0];
    ndkEvent.tags = [];
    for (let i = 0; i < eventList.length; i++) {

        ndkEvent.tags.push(['e', eventList[i].id, relayUrls[0]])
        console.log(`Adding ${eventList[i].id} to tags`);
    }

    await ndk.connect().then(() => {
        ndkEvent.kind = 30040;
        ndkEvent.content = `{"corpusId": "${corpusID}", "title": "${articleTitle}"}`;
        ndkEvent.pubkey = getPublicKey(pubKey);
    }).catch((err: any) => { console.log(err) })
    console.log(`Signing and publishing ${ndkEvent.id}`);
    await ndkEvent.sign(signer);
    await ndk.publish(ndkEvent);
    return ndkEvent;
}
const main = async (): Promise<void> => {
    // Reads all files in the updatedOutput folder and creates a note for each
    // const jsonFolder: string[] = fs.readdirSync('./updatedOutput');
    const jsonFolder: string[] = fs.readdirSync('./notes');
    const jsonFiles: string[] = jsonFolder.filter((file: string) => file.endsWith('.json'));
    // Load user keys
    const userKeys: Keys = loadNPUB('./user.json');
    const nsec: string = userKeys.nsec;
    const privateKey: nip19.DecodeResult = nip19.decode(nsec) as { type: 'nsec', data: string };
    const pubKey: string = privateKey.data;
    // Signer for nostr allows us to sign events
    // meaning each published event is verifiable as coming from a specific user
    const signer: NDKPrivateKeySigner = new NDKPrivateKeySigner(privateKey.data);

    // Create NDK object, which allows us to connect to the nostr network
    // and publish events
    // explicitRelayUrls is a list of nostr relays to connect to (in this case, just indextr.com but can be more)
    const ndk: NDK = new NDK({
        explicitRelayUrls: [relayUrls[0]],
        signer: signer
    })
    let eventList: NDKEvent[] = [];

    // create list of articles in folder. format is <article_name>_<start_token>_<end_token>.json
    // const articlenames: string[] = jsonFiles.map((file: string) => file.split('_')[0]).filter((value: string, index: number, self: string[]) => self.indexOf(value) === index);
    // print out list of article names
    // articlenames.forEach((name: string) => console.log(name));

    const forward_files: string[] = jsonFiles.filter((file: string) => file.includes(articleName)).sort((a: string, b: string) => Number(a.split('.')[0]) - Number(b.split('.')[0]));
    // ix = 20;
    // const forward_files: string[] = jsonFiles.filter((file: string) => file.includes(articlenames[ix])).sort((a: string, b: string) => Number(a.split('.')[0]) - Number(b.split('.')[0]));
    console.log(`Found ${forward_files.length} files`);
    for (let i = 0; i < forward_files.length; i++) {
        console.log(`Processing ${forward_files[i]}`);
        // const text: Note = loadJSON(`./notes/${forward_files[i]}`);
        const text: Note = loadJSON(path.join('./notes', forward_files[i]));


        // JSON looks like this:
        // filename is <corpusID>_{start_token}_{end_token}.json
        // corpusID is attained from semantic scholar (see )
        // {"text": <text>, "title": <title>,
        // "subtitle": <subtitle>, "fieldsOfStudy": [<field1>, <field2>, ...]}

        // Create a note for each file
        // wrapped allows us to use a rate limiter to limit the number of requests per second as defined at the top of the file
        // it is needed because without, we would be publishing many events per second, which can cause the relay to reject our requests
        const wrapped: Promise<NDKEvent> = limiter.schedule(createNote, text, pubKey, ndk, signer);
        const event: NDKEvent = await wrapped;
        eventList.push(await event);
        console.log(`List is now ${eventList.length} long`);
    }

    // Create an article header for the article
    // this event contains the metadata for the article, including the title and the list of notes that compose the article
    const wrapped2: Promise<NDKEvent> = limiter.schedule(createArticleHeader, loadJSON(`./notes/${forward_files[0]}`), forward_files[0], pubKey, eventList, ndk, signer, articleName);
    const header: NDKEvent = await wrapped2;
    await header;
    console.log(`Created article header ${articleName}`);
}

const wrappedMain: Promise<void> = limiter.schedule(main);
// await wrappedMain;
