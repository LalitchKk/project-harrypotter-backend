import {
    getDownloadURL,
    getStorage,
    ref,
    uploadBytesResumable,
} from "firebase/storage";

export const giveCurrentDateTime = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Month is zero-based, so we add 1 and pad with zero if necessary
    const day = String(today.getDate()).padStart(2, '0'); // Pad day with zero if necessary
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

