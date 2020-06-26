if ( process.env.ELEVENTY_PRODUCTION ) {

  const fs = require('fs');
  const spotifyWebApi = require('spotify-web-api-node');
  module.exports = () => {

    require('dotenv').config();

    const paths = {
      spotify: {
        dest: '/../',
        playlists: [
          ['0phr7QOeXCConRswu3ZEtv', 'spotify_now.json']
        ]
      }
    };

    const spotify = new spotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENTID,
      clientSecret: process.env.SPOTIFY_CLIENTSECRET
    });

    spotify.clientCredentialsGrant()
    .then(function(data) {
      spotify.setAccessToken(data.body['access_token']);

      paths.spotify.playlists.forEach(function(playlist) {
        spotify.getPlaylistTracks(playlist[0])
          .then(function(data) {
            var playlistTracks = data.body;

            fs.writeFile(__dirname + paths.spotify.dest + playlist[1], JSON.stringify(playlistTracks), err => {
              if(err) {
                console.log(err);
              } else {
                console.log('Updated spotify playlist: ' + playlist[1] + ' .json');
              }
            });

          }, function(err) {
            console.log('Something went wrong!', err);
          });
      });
    });
  }
}
