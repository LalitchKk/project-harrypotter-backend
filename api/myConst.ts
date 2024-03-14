
export const giveCurrentDateTime = () => {
    const today = new Date();
    const date =
      today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
    return date;
  };
  
  export const imageURL = "https://firebasestorage.googleapis.com/v0/b/store-picture.appspot.com/o/image%2Fdefualt_image.jpg?alt=media&token=f7623470-c451-4488-912e-ab753a826ccb";

  