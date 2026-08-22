export class SapB1SessionStore {
  private cookie: string | null;

  constructor(initialCookie: string | null = null) {
    this.cookie = initialCookie;
  }

  getCookie(): string | null {
    return this.cookie;
  }

  getRequestCookie(): string | null {
    return this.cookie?.split(";")[0] ?? null;
  }

  setCookie(cookie: string): void {
    this.cookie = cookie;
  }

  clear(): void {
    this.cookie = null;
  }
}
