"use strict";
const name = document.querySelector("#name");
const email = document.querySelector("#email");
const button = document.querySelector("#button");
const form = document.querySelector("#form");
const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdfPJXl3QuZf2zoaZudRMLHu-3rbeZ9-BQpFrKeoinQ2cb0qA/formResponse";

const handleSubmit = async (event) => {
  event.preventDefault();
  const formData = {
    "entry.684158808": email.value,
  };
  const appendedFormData = newFormData({ ...formData });

  try {
    button.disabled = true;
    button.textContent = "processing...";
    await fetch(GOOGLE_FORM_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
      },
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

form.addEventListener("submit", handleSubmit);

const newFormData = (inputs) => {
  const formData = new FormData();
  const newArr = Object.entries(inputs);
  newArr.map((item) => {
    return formData.append(`${item[0]}`, item[1]);
  });
  return formData;
};
