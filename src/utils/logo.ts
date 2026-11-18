// Logo asset paths and helper for PDF embedding
export const LOGO_URL = '/assets/aistudio/GLECO_LOGO_76c33170.png';

let cachedLogoBase64: string | null = null;

/**
 * Loads the ASG logo as a Base64 data URL for jsPDF embedding
 */
export async function getLogoBase64(): Promise<string | null> {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoBase64 = reader.result as string;
        resolve(cachedLogoBase64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Could not load logo for PDF:', err);
    return null;
  }
}
