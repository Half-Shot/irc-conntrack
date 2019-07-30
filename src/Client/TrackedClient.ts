/**
 * This client corresponds to one local or remote IRC connection
 * which can be used to initiate requests on behalf of a user.
 */
export class TrackedClient {
    constructor(public readonly server: string, public readonly id: string) {

    }
}