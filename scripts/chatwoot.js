  window.chatwootSettings = {"position":"right","type":"standard","launcherTitle":"Chat with us"};
  (function(d,t) {
    var BASE_URL="https://chat.rmtutoringservices.com";
    var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
    g.src=BASE_URL+"/packs/js/sdk.js";
    g.defer = true;
    g.async = true;
    s.parentNode.insertBefore(g,s);
    g.onload=function(){
      window.chatwootSDK.run({
        websiteToken: 'HaHvx5RbQWm4ynZhwe7r8dwZ',
        baseUrl: BASE_URL
      })
    }
  })(document,"script");
