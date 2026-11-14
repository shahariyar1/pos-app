/** Product groups used for filtering (Cover, Charger, Cable ...). Any other name you type also works. */
export const GROUPS = ["Cover", "Display", "Charger", "Cable", "Headphones", "TWS", "Neckband", "Audio", "Power Bank", "OTG", "Battery"];

/** "charger" -> "Charger". Returns "" when the code is not a known group. */
export const groupFromCode = (code: string) => GROUPS.find((g) => g.toLowerCase() === code.trim().toLowerCase()) ?? "";
