const productShot = document.getElementById("product-shot");
const themeButtons = document.querySelectorAll("[data-theme-button]");

themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const theme = button.dataset.themeButton;
    const isLight = theme === "light";

    themeButtons.forEach((item) => item.classList.toggle("active", item === button));
    productShot.style.opacity = "0";

    window.setTimeout(() => {
      productShot.src = isLight ? "assets/tabscroll-light.png" : "assets/tabscroll-dark.png";
      productShot.alt = `TabScroll in ${isLight ? "light" : "night"} mode`;
      productShot.style.opacity = "1";
    }, 120);
  });
});
