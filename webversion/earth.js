// Created by Bjorn Sandvik - thematicmapping.org

	var webglEl = document.getElementById('webgl');

	var width  = 512,
		height = 512;

	// Earth params
	var radius   = 0.5,
		segments = 32,
		rotation = 6;  

	var scene = new THREE.Scene();

	var scene2 = new THREE.Scene();

	var scene3 = new THREE.Scene();

	var camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 1000);
	camera.position.z=1.5;
	

	function updateCamera(declination){
		camera.position.z = 1.5*Math.cos(declination);
		camera.position.y = 1.5*Math.sin(declination);
		camera.lookAt(new THREE.Vector3(0, 0, 0));
	}


	var renderer = new THREE.WebGLRenderer({ alpha: true });
	renderer.setSize(width, height);
	renderer.autoClear = false;

	scene.add(new THREE.AmbientLight(0x333333));

	var light = new THREE.DirectionalLight(0xffffff, 1);
	light.position.set(5,3,5);
	scene.add(light);

	var sphere = createSphere(radius, segments);
	sphere.rotation.y = rotation;
	scene.add(sphere);

	var sphere2 = createSphere(0.000000001, segments);
	sphere2.rotation.y = rotation; 
	scene2.add(sphere2);

	var sphere3 = createSphere(0.000000001, segments);
	sphere3.rotation.y = rotation; 
	scene3.add(sphere3);

	var clouds = createClouds(radius, segments);
	clouds.rotation.y = rotation;
	scene.add(clouds);


	function addMarkers(){

		//create baselines
		var baselineLocations=[];
		for (i=0;i<(locations.length-1);i++){
            for (j=i+1;j<locations.length;j++){
            	createBaseline(radius,locations[i].longitude,locations[i].latitude,locations[j].longitude,locations[j].latitude);
            }
        }              
       	
       	//create marker
		for (let c=0;c<locations.length;c++){
			createMarker(radius,locations[c].longitude,locations[c].latitude);
		}
	}

	function removeAllMarkers(){
		for (var i = sphere2.children.length - 1; i >= 0; i--) {
    		sphere2.remove(sphere2.children[i]);
		}

		for (var i = sphere3.children.length - 1; i >= 0; i--) {
    		sphere3.remove(sphere3.children[i]);
		}
	}


	//var controls = new THREE.TrackballControls(camera);

	webglEl.appendChild(renderer.domElement);

	render();

	function RotateGlobe(rad_value,indx){

		//check which telescopes and baselines will be visible
		var TelChilds=[];
		var BaselineChilds=[];

		sphere2.traverse ( function (child) {
	    	if (child instanceof THREE.Line){
	    		BaselineChilds.push(child);
	    	}
  		});

  		sphere3.traverse (function (child){
	  		if (child instanceof THREE.Mesh) {
	      		TelChilds.push(child);
	    	}
  		});

		var count_indx=0;
  		for (i=0;i<locations.length-1;i++){
  			for(k=i+1;k<locations.length;k++){
  				if (tel_visibles[indx][i] && tel_visibles[indx][k]){
  					BaselineChilds[count_indx].visible=true;
  				} else {
  					BaselineChilds[count_indx].visible=false;
  				}
  				count_indx++;
  			}
  		}

  		for (i=0;i<locations.length;i++){
  			if(tel_visibles[indx][i]){
  				TelChilds[i+1].visible=true;
  			} else {
  				TelChilds[i+1].visible=false;
  			}
  		}

  		

		//do rotation
		sphere.rotation.y=rad_value;
		clouds.rotation.y=rad_value;
		sphere2.rotation.y=rad_value;
		sphere3.rotation.y=rad_value;
	}

	function render() {
		//controls.update();
		//sphere.rotation.y +=0.005; //angle in rad
		//marker_new.rotation.y +=0.005;
		requestAnimationFrame(render);
		renderer.clear();                     // clear buffers
		renderer.render( scene, camera );     // render scene 1
		renderer.clear( false, true, false );                // clear depth buffer
		renderer.render( scene2, camera );
		renderer.clear(false,true,false);
		renderer.render(scene3,camera);
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

    	x = -((radius) * Math.sin(phi)*Math.cos(theta));
    	z = ((radius) * Math.sin(phi)*Math.sin(theta));
    	y = ((radius) * Math.cos(phi));

		var marker = new THREE.Mesh(
			new THREE.SphereGeometry(0.010,segments,segments),
			new THREE.MeshBasicMaterial( { color: 0xffff00 } )
		);

		marker.position.x = x;
		marker.position.y = y;
		marker.position.z = z;

		marker.rotation.y = rotation;
		sphere3.add(marker);
	}

		function createBaseline(radius,lon,lat,lon2,lat2){

		  
    	var phi1   = (90-lat)*(Math.PI/180);
    	var theta1 = (lon+180)*(Math.PI/180)+3/32*Math.PI;

    	x1 = -(radius * Math.sin(phi1)*Math.cos(theta1));
    	z1 = (radius * Math.sin(phi1)*Math.sin(theta1));
    	y1 = (radius * Math.cos(phi1));


    	var phi2   = (90-lat2)*(Math.PI/180);
    	var theta2 = (lon2+180)*(Math.PI/180)+3/32*Math.PI;

    	x2 = -(radius * Math.sin(phi2)*Math.cos(theta2));
    	z2 = (radius * Math.sin(phi2)*Math.sin(theta2));
    	y2 = (radius * Math.cos(phi2));

		const material = new THREE.LineBasicMaterial( { color: 0x0000ff,linewidth: 5, depthTest: false} );
		const geometry = new THREE.Geometry()
		geometry.vertices.push( new THREE.Vector3(x1, y1, z1 ));
		geometry.vertices.push( new THREE.Vector3(x2, y2, z2 ));
		const line = new THREE.Line(geometry, material);

		line.rotation.y = rotation;
		sphere2.add(line);

	}
