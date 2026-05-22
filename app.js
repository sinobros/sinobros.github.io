"use strict";
const email = document.querySelector("#email");
const button = document.querySelector("#button");
const form = document.querySelector("#form");
const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdfPJXl3QuZf2zoaZudRMLHu-3rbeZ9-BQpFrKeoinQ2cb0qA/formResponse";

const handleSubmit = async (event) => {
  event.preventDefault();
//  const fullNameValue = fullName.value;
  const emailValue = email.value;
//  const notesValue = notes.value;
  const formData = {
    "entry.684158808": emailValue, // entry.253486596 is the name attribute for the full name field on our google form
  };
  const appendedFormData = newFormData({ ...formData });

  try {
    button.disabled = true;
    button.textContent = "processing...";
    const response = await fetch(GOOGLE_FORM_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: appendedFormData,
    });
    alert("Form submitted to google spreadsheet successfully!");
  } catch (error) {
    alert("Something went wrong, please try again");
    console.log(error);
  } finally {
    button.disabled = false;
    button.textContent = "Submit";
  }
};

form.addEventListener("submit", handleSubmit);

// A helper function to help convert the data to FormData
const newFormData = (inputs) => {
  const formData = new FormData();
  const newArr = Object.entries(inputs);
  newArr.map((item) => {
    return formData.append(`${item[0]}`, item[1]);
  });
  return formData;
};