/** The file an asset url names, without its folder or query. */
export const fileOf = (src: string | null | undefined) => src?.split('?')[0].split('/').pop();
