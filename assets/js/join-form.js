"use strict";

const email = document.querySelector("#email");
const button = document.querySelector("#button");
const form = document.querySelector("#form");
const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdg7KZYCkEEYdBNSsR9Uo838bN_l8wMY0zQ3nOtj0JAYcLIew/formResponse";

const newFormData = (inputs) => {
  const formData = new FormData();
  Object.entries(inputs).forEach(([key, value]) => {
    formData.append(key, value);
  });
  return formData;
};

const handleSubmit = async (event) => {
  event.preventDefault();

  const appendedFormData = newFormData({
    "entry.1316044900": "noname-emailsignuponly",
    "entry.593239121": email.value,
    "entry.749902489": "nomessage-emailsignuponly",
  });

  try {
    button.disabled = true;
    button.textContent = "processing...";
    await fetch(GOOGLE_FORM_URL, {
      method: "POST",
      mode: "no-cors",
      body: appendedFormData,
    });
    alert("We will be in touch soon!");
    form.reset();
  } catch (error) {
    alert("Something went wrong, please try again");
    console.log(error);
  } finally {
    button.disabled = false;
    button.textContent = "Join Sinobros";
  }
};

if (form) {
  form.addEventListener("submit", handleSubmit);
}
