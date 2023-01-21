// Created by Bjorn Sandvik - thematicmapping.org

	var webglEl = document.getElementById('webgl');

	var width  = 512,
		height = 512;

	// Earth params
	var radius   = 0.5,
		segments = 32,
		rotation = 6;  

	var scene = new THREE.Scene();

	var camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 1000);
	camera.position.z=1.5;
	

	function updateCamera(declination){
		camera.position.z = 1.5*Math.cos(declination);
		camera.position.y = 1.5*Math.sin(declination);
		camera.lookAt(new THREE.Vector3(0, 0, 0));
	}


	var renderer = new THREE.WebGLRenderer({ alpha: true });
	renderer.setSize(width, height);

	scene.add(new THREE.AmbientLight(0x333333));

	var light = new THREE.DirectionalLight(0xffffff, 1);
	light.position.set(5,3,5);
	scene.add(light);

	var sphere = createSphere(radius, segments);
	sphere.rotation.y = rotation; 
	scene.add(sphere);

	var clouds = createClouds(radius, segments);
	clouds.rotation.y = rotation;
	scene.add(clouds)


	function addMarkers(){
		for (let c=0;c<locations.length;c++){
			createMarker(radius,locations[c].longitude,locations[c].latitude);
		}
	}

	function removeAllMarkers(){
		for (var i = sphere.children.length - 1; i >= 0; i--) {
    		sphere.remove(sphere.children[i]);
		}
	}


	//var controls = new THREE.TrackballControls(camera);

	webglEl.appendChild(renderer.domElement);

	render();

	function RotateGlobe(rad_value){
		sphere.rotation.y=rad_value;
		clouds.rotation.y=rad_value;
	}

	function render() {
		//controls.update();
		//sphere.rotation.y +=0.005; //angle in rad
		//marker_new.rotation.y +=0.005;
		requestAnimationFrame(render);
		renderer.render(scene, camera);
	}

	function createSphere(radius, segments) {
		return new THREE.Mesh(
			new THREE.SphereGeometry(radius, segments, segments),
			new THREE.MeshPhongMaterial({
				map:         THREE.ImageUtils.loadTexture('img/2_no_clouds_4k.jpg'),
				bumpMap:     THREE.ImageUtils.loadTexture('img/elev_bump_4k.jpg'),
				bumpScale:   0.005,
				specularMap: THREE.ImageUtils.loadTexture('img/water_4k.png'),
				specular:    new THREE.Color('grey')								
			})
		);
	}

	function createClouds(radius, segments) {
		return new THREE.Mesh(
			new THREE.SphereGeometry(radius + 0.003, segments, segments),			
			new THREE.MeshPhongMaterial({
				map:         THREE.ImageUtils.loadTexture('img/fair_clouds_4k.png'),
				transparent: true
			})
		);		
	}

	function createStars(radius, segments) {
		return new THREE.Mesh(
			new THREE.SphereGeometry(radius, segments, segments), 
			new THREE.MeshBasicMaterial({
				map:  THREE.ImageUtils.loadTexture('img/galaxy_starfield.png'), 
				side: THREE.BackSide
			})
		);
	}

	function createMarker(radius,lon,lat){

		  
    	var phi   = (90-lat)*(Math.PI/180);
    	var theta = (lon+180)*(Math.PI/180);

    	x = -(radius * Math.sin(phi)*Math.cos(theta));
    	z = (radius * Math.sin(phi)*Math.sin(theta));
    	y = (radius * Math.cos(phi));

		var marker = new THREE.Mesh(
			new THREE.SphereGeometry(0.010,segments,segments),
			new THREE.MeshBasicMaterial( { color: 0xffff00 } )
		);

		marker.position.x = x;
		marker.position.y = y;
		marker.position.z = z;

		marker.rotation.y = rotation;
		sphere.add(marker);
	}
