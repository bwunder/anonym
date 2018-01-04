const Docker = require('dockerode')
const config = require('./config.json')
const docker = new Docker()
const sqlCatalog = {
  'Images': new Map(),
  'Containers': new Map(),
  'Instance': []
};

return docker.listImages({"filters": { "reference": [config.docker.repo]}})
.then(

  (images) => {
    images.forEach( (image) => {
      if (image.RepoDigests[0].startsWith(`${config.docker.repo}@`)) {

        sqlCatalog.Images.set(image.Id,  image)
        return docker.listContainers({
          "all": true,
          "size": true,
          "filters": { "ancestor": [image.Id] }
        })
        .then( (containers) => {

          containers.forEach(function (container) {
            sqlCatalog.Containers.set(container.Id, container)
            if (container.State==='running') {
              sqlCatalog.Instance.push(container.Id)
              api.log('log', `(sqlCatalog) set instance ${container.Id} (1 of ${api.sqlCatalog.Instance.length})`)
            }
          });

        })
        .catch( (err) => {
          console.log('debug', `(setCatalog) docker.listContainers error`)
          console.log('error', err.message)
          console.log('debug', err.stack)
        })
      }
    })
})
.then( () => {

  return console.warn(sqlCatalog)

})
.catch( (err) => {
  console.log('debug', `(setCatalog) docker.listImages error`)
  console.log('error', err.message)
  console.log('debug', err.stack)
})
