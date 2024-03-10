
export const giveCurrentDateTime = () => {
    const today = new Date();
    const date =
      today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
    return date;
  };
  
  export const imageURL = "gs://store-picture.appspot.com/image/default_image.jpg";

  