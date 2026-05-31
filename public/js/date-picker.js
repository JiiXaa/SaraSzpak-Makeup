const dateInputs = document.querySelectorAll("[data-date-picker]");

function openNativePicker(input) {
  if (typeof input.showPicker === "function") {
    input.showPicker();
    return;
  }

  input.focus();
}

dateInputs.forEach((input) => {
  const group = input.closest(".form__group");
  const toggle = group?.querySelector("[data-date-picker-toggle]");

  if (window.flatpickr) {
    const picker = window.flatpickr(input, {
      altInput: true,
      altFormat: "l, j F Y",
      dateFormat: "Y-m-d",
      disableMobile: true,
      static: true,
      minDate: "today",
      nextArrow: '<i class="fa-solid fa-chevron-right"></i>',
      prevArrow: '<i class="fa-solid fa-chevron-left"></i>',
      monthSelectorType: "static",
      onReady: (_selectedDates, _dateStr, instance) => {
        const label = document.querySelector(`label[for="${input.id}"]`);

        instance.altInput.id = `${input.id}Display`;
        label?.setAttribute("for", instance.altInput.id);
        instance.altInput.setAttribute("aria-describedby", "eventDate-hint");
        instance.altInput.setAttribute("placeholder", "Choose your date");
        instance.altInput.setAttribute("required", "");
      },
      onChange: (_selectedDates, _dateStr, instance) => {
        input.classList.remove("is-invalid");
        input.removeAttribute("aria-invalid");
        instance.altInput.classList.remove("is-invalid");
        instance.altInput.removeAttribute("aria-invalid");
        instance.altInput.removeAttribute("title");
      },
    });

    toggle?.addEventListener("click", () => picker.open());
    return;
  }

  input.type = "date";
  input.min = new Date().toISOString().slice(0, 10);
  toggle?.addEventListener("click", () => openNativePicker(input));
});
