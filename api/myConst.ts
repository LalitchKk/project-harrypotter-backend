import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from "firebase/storage";

export const giveCurrentDateTime = () => {
  // Create a new Date object and get its values in Bangkok time
  const today = new Date();
  const offset = 7; // Bangkok is UTC+7
  const utc = today.getTime() + (today.getTimezoneOffset() * 60000);
  const bangkokTime = new Date(utc + (3600000 * offset));

  // Extract year, month, and day from the Bangkok time
  const year = bangkokTime.getFullYear();
  const month = String(bangkokTime.getMonth() + 1).padStart(2, '0'); // Month is zero-based, so we add 1 and pad with zero if necessary
  const day = String(bangkokTime.getDate()).padStart(2, '0'); // Pad day with zero if necessary

  // Return the formatted date string
  return `${year}-${month}-${day}`;
};



export const imageURL =
  "https://firebasestorage.googleapis.com/v0/b/store-picture.appspot.com/o/image%2Fdefualt_image.jpg?alt=media&token=f7623470-c451-4488-912e-ab753a826ccb";

async function uploadImage(reqFile: any, dateTime: any) {
  const storage = getStorage();
  let image = imageURL;

  if (!reqFile || !reqFile.originalname) {
    return imageURL;
  } else {
    const storageRef = ref(
      storage,
      `image/${reqFile.originalname + "       " + dateTime}`
    );
    const metadata = {
      contentType: reqFile.mimetype,
    };

    try {
      const snapshot = await uploadBytesResumable(
        storageRef,
        reqFile.buffer,
        metadata
      );

      const downloadURL = await getDownloadURL(snapshot.ref);
      image = downloadURL;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw new Error("Error uploading image");
    }
  }

  return image;
}
export { uploadImage };

