
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: document.getElementById('username').value,
      password: document.getElementById('password').value
    })
  });
  const data = await res.json();
  if (data.token) {
    localStorage.setItem('token', data.token);
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('excelForm').style.display = 'block';
  } else {
    alert('Login fallido');
  }
});

document.getElementById('excelForm').addEventListener('submit', async e => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const res = await fetch('/api/upload/excel', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
    body: formData
  });
  const data = await res.json();
  alert(data.message);
});
