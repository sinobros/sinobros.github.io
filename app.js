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


// Hamburger menu toggle (works on all pages)
const navToggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.nav');

if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    navToggle.classList.toggle('open', isOpen);
    navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // Close menu when clicking any nav link (better mobile UX)
  nav.querySelectorAll('a.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      navToggle.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // Optional: close when clicking outside
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target) && !navToggle.contains(e.target) && nav.classList.contains('open')) {
      nav.classList.remove('open');
      navToggle.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });
}
