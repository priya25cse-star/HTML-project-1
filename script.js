// 1. Select HTML elements
const form = document.getElementById("contactForm");
const nameInput = document.getElementById("name");
const livePreview = document.getElementById("livePreview");
const responseMessage = document.getElementById("responseMessage");

// 2. Live name preview using input event
if (nameInput && livePreview) {

    nameInput.addEventListener("input", function() {

        livePreview.innerText =
            nameInput.value ? "Your name: " + nameInput.value : "";

    });

}

// 3. Form submission using submit event
if (form && responseMessage) {

    form.addEventListener("submit", function(event) {

        event.preventDefault();

        responseMessage.innerText =
            "Thank you! Your details have been submitted.";

        responseMessage.style.color = "green";

        // Redirect to Thank You page
        setTimeout(function() {

            window.location.href = "thankyou.html";

        }, 1500);

    });

}
// Today's Special button
const specialButton = document.getElementById("specialButton");
const specialMessage = document.getElementById("specialMessage");

if (specialButton && specialMessage) {

    specialButton.addEventListener("click", function() {

        specialMessage.innerText =
            "Today's Special: Belgian Waffle";

    });

}
