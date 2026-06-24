import {
  auth,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "./firebase.js";

const form = document.getElementById("loginForm");
const emailInput = document.getElementById("loginEmail");
const senhaInput = document.getElementById("loginSenha");
const erro = document.getElementById("loginErro");

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "index.html";
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  let email = emailInput.value.trim();
  const senha = senhaInput.value.trim();

  if (!email.includes("@")) {
    email = `${email}@atnoc.local`;
  }

  try {
    erro.textContent = "";
    await signInWithEmailAndPassword(auth, email, senha);
    window.location.href = "index.html";
  } catch (error) {
    erro.textContent = "E-mail/usuário ou senha incorretos.";
  }
});
